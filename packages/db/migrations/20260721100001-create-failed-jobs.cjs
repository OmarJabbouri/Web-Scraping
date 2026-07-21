'use strict';

// failed_jobs — the persistent side of the dead-letter mechanism (task 2.3). BullMQ keeps failed
// jobs in Redis, but Redis is a cache we may flush; a job that exhausted all retries is an
// operational fact we want to keep and query in Postgres (which queue, which URL, why it died).
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('failed_jobs', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      queue: { type: Sequelize.STRING, allowNull: false },
      job_id: { type: Sequelize.STRING, allowNull: true },
      payload: { type: Sequelize.JSONB, allowNull: false },
      error_message: { type: Sequelize.TEXT, allowNull: true },
      error_stack: { type: Sequelize.TEXT, allowNull: true },
      attempts_made: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      failed_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('failed_jobs', ['queue']);
    await queryInterface.addIndex('failed_jobs', ['failed_at']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('failed_jobs');
  },
};
