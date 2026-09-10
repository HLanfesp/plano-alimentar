// Service worker do Plano Alimentar.
//
// Estrategia: cache-first sobre uma lista explicita de arquivos (sem
// dependencias, sem build). O app precisa abrir sem rede as 5h da manhã
// antes do treino e as 22h na ceia — por isso TUDO que a tela usa tem
// que estar nesta lista, inclusive os dados do mes atual.
//
// Versionamento: mude CACHE_NOME (ex.: "plano-v2") sempre que algum
// arquivo listado abaixo mudar de conteudo — por exemplo, ao publicar o
// cardapio de um novo mes. O "activate" apaga qualquer cache antigo, para
// o usuario nunca ficar preso vendo uma versao desatualizada sem saber.
const CACHE_NOME = "plano-v1";

const ARQUIVOS_PARA_CACHE = [
  "./",
  "index.html",
  "manifest.json",
  "icone-192.png",
  "icone-512.png",
  "src/app.js",
  "src/armazenamento.js",
  "src/metas.js",
  "src/nutricao.js",
  "src/semana.js",
  "src/sugestao.js",
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
      .then((cache) => cache.addAll(ARQUIVOS_PARA_CACHE))
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
            .filter((nome) => nome !== CACHE_NOME)
            .map((nome) => caches.delete(nome))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  // Cache-first: se o arquivo esta no cache, serve direto (funciona offline).
  // Senao, busca na rede e guarda uma copia para a proxima vez.
  evento.respondWith(
    caches.match(evento.request).then((respostaCache) => {
      if (respostaCache) return respostaCache;

      return fetch(evento.request)
        .then((respostaRede) => {
          const copia = respostaRede.clone();
          caches
            .open(CACHE_NOME)
            .then((cache) => cache.put(evento.request, copia));
          return respostaRede;
        })
        .catch(() => respostaCache);
    })
  );
});
