'use strict';

// Raw SQL: Sequelize's schema builder has no vector type or generated-column support,
// and this table needs both (embedding vector(1536) + a STORED tsvector for keyword search).
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE TABLE chunks (
        id SERIAL PRIMARY KEY,
        document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        heading_path TEXT,
        text TEXT NOT NULL,
        token_count INTEGER NOT NULL,
        embedding vector(1536),
        content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (document_id, chunk_index)
      );
    `);

    // HNSW over IVFFlat: no "lists" parameter to tune against a dataset size we don't know yet,
    // and better recall/build behavior for pgvector >= 0.5.
    await queryInterface.sequelize.query(`
      CREATE INDEX chunks_embedding_hnsw_idx ON chunks
      USING hnsw (embedding vector_cosine_ops);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX chunks_content_tsv_gin_idx ON chunks
      USING gin (content_tsv);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX chunks_document_id_idx ON chunks (document_id);
    `);
  },
  down: async (queryInterface) => {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS chunks;');
  },
};
