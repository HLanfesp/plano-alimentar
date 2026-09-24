// Service worker do Plano Alimentar.
//
// Estrategia: cache-first para o casco do app (HTML, JS, icones) — isso
// nao muda sem um deploy novo, entao servir do cache e seguro e instantaneo.
// Para os dados em dados/ (inclusive o indice dos planos mensais), a
// estrategia e network-first com fallback pro cache: assim um plano novo
// publicado em dados/indice.json e descoberto assim que houver rede,
// sem precisar bumpar CACHE_NOME nem editar esta lista. Se a rede falhar
// (ou demorar demais), cai pro cache na hora, sem travar a tela.
//
// O app precisa abrir sem rede as 5h da manha antes do treino e as 22h na
// ceia — por isso tudo que a tela usa tem que estar na lista abaixo, para
// o "install" deixar uma copia pronta desde a primeira visita.
//
// Versionamento: mude CACHE_NOME (ex.: "plano-alimentar-v2") sempre que um
// arquivo do CASCO (HTML/JS/icone) mudar de conteudo. Dados de dados/ nao
// dependem mais disso, porque sao buscados na rede primeiro.
//
// Nome do cache com prefixo "plano-alimentar-": esta origem
// (hlanfesp.github.io) hospeda outros projetos do mesmo usuario
// (treino-setembro-2026, treino-agosto-2026, treino-julho-2026,
// treino-abril-2026, treino-lenize) que podem ter seu proprio Cache
// Storage. caches.keys() e escopado por ORIGEM, nao por caminho — um
// "activate" que apague "tudo que nao for o cache atual" apagaria o cache
// desses outros apps tambem. O "activate" abaixo so toca em caches cujo
// nome comeca com este prefixo.
const PREFIXO_CACHE = "plano-alimentar-";
const CACHE_NOME = PREFIXO_CACHE + "v2";

// Tempo maximo de espera pela rede nos arquivos de dados antes de cair
// pro cache. Evita travar a tela numa conexao presente mas lenta/instavel
// (ex.: wifi ruim) — o fallback fica imediato mesmo nesse caso.
const TEMPO_LIMITE_REDE_MS = 2500;

const ARQUIVOS_PARA_CACHE = [
  "./",
  "index.html",
  "manifest.json",
  "icone-192.png",
  "icone-512.png",
  "src/app.js",
  "src/armazenamento.js",
  "src/indice.js",
  "src/metas.js",
  "src/nutricao.js",
  "src/semana.js",
  "src/sugestao.js",
  "dados/indice.json",
  "dados/alimentos.json",
  "dados/combustivel.json",
  "dados/extras.json",
  "dados/plano-2026-09.json",
  "dados/unidades.json",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE_NOME)
      // `cache: "reload"` busca direto no servidor, pulando o cache HTTP do
      // navegador. O GitHub Pages manda guardar cada arquivo por 10 minutos
      // (max-age=600); sem isto, uma versão nova instalada dentro dessa
      // janela encheria o cache novo com arquivos VELHOS — e o app ficaria
      // preso neles até a atualização seguinte. Achado em 24/Set/2026.
      .then((cache) =>
        cache.addAll(ARQUIVOS_PARA_CACHE.map((url) => new Request(url, { cache: "reload" })))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) =>
        Promise.all(
          nomes
            .filter((nome) => nome.startsWith(PREFIXO_CACHE) && nome !== CACHE_NOME)
            .map((nome) => caches.delete(nome))
        )
      )
      .then(() => self.clients.claim())
  );
});

// fetch() com um teto de tempo: se a rede nao responder a tempo, rejeita
// e quem chamou cai pro cache — sem esperar o timeout nativo do navegador,
// que pode levar bem mais que isso numa rede ruim.
function buscarComTimeout(request) {
  return new Promise((resolve, reject) => {
    const temporizador = setTimeout(
      () => reject(new Error("tempo limite de rede excedido")),
      TEMPO_LIMITE_REDE_MS
    );
    // `no-cache`: revalida com o servidor (ETag) em vez de aceitar a cópia de
    // até 10 minutos do cache HTTP — um plano ou extra novo aparece na hora.
    fetch(request, { cache: "no-cache" }).then(
      (resposta) => {
        clearTimeout(temporizador);
        resolve(resposta);
      },
      (erro) => {
        clearTimeout(temporizador);
        reject(erro);
      }
    );
  });
}

function guardarNoCache(request, resposta) {
  const copia = resposta.clone();
  caches.open(CACHE_NOME).then((cache) => cache.put(request, copia));
  return resposta;
}

self.addEventListener("fetch", (evento) => {
  // So GET e cacheavel/interceptavel. Sem este filtro, um POST (ex.: de
  // outra integracao futura) cai no mesmo caminho e `cache.put` lanca
  // ("Request method 'POST' is unsupported"), virando uma Promise
  // rejeitada engolida em silencio. Metodos nao-GET seguem pra rede normal.
  if (evento.request.method !== "GET") return;

  const url = new URL(evento.request.url);
  const ehArquivoDeDados = url.pathname.includes("/dados/");

  if (ehArquivoDeDados) {
    // Network-first: busca na rede pra descobrir plano novo assim que
    // houver conexao; se a rede falhar ou demorar, cai pro cache na hora
    // (o app continua funcionando offline com o que ja tinha).
    evento.respondWith(
      buscarComTimeout(evento.request)
        .then((respostaRede) => guardarNoCache(evento.request, respostaRede))
        .catch(() => caches.match(evento.request))
    );
    return;
  }

  // Cache-first para o resto (HTML, JS, icones): nao muda sem deploy novo,
  // entao servir do cache e seguro e evita qualquer espera de rede.
  evento.respondWith(
    caches.match(evento.request).then((respostaCache) => {
      if (respostaCache) return respostaCache;

      return fetch(evento.request)
        .then((respostaRede) => guardarNoCache(evento.request, respostaRede))
        .catch(() => respostaCache);
    })
  );
});
