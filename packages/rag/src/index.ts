export { getOpenAI, EMBEDDING_MODEL, ANSWER_MODEL } from './client.js';
export { embedQuery, toVectorLiteral } from './embed.js';
export {
  vectorSearch,
  keywordSearch,
  hybridSearch,
  multiHybridSearch,
  rrfMerge,
  search,
  type RetrievedChunk,
  type SearchMode,
} from './retrieve.js';
export { answerQuestion, generateAnswer, type RagAnswer, type Citation } from './answer.js';
