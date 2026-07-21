'use strict';

// Phase 3 schema:
//   - per-site crawl limits (max_depth, max_pages) so a crawl is bounded and predictable;
//   - crawl_sessions: one row per crawl run, with live counters the UI reads (task 3.7).
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('sites', 'max_depth', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 2,
    });
    await queryInterface.addColumn('sites', 'max_pages', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 50,
    });

    await queryInterface.createTable('crawl_sessions', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      site_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'sites', key: 'id' },
        onDelete: 'CASCADE',
      },
      status: {
        type: Sequelize.ENUM('running', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'running',
      },
      max_depth: { type: Sequelize.INTEGER, allowNull: false },
      max_pages: { type: Sequelize.INTEGER, allowNull: false },
      pages_crawled: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      pages_skipped: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      pages_failed: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      started_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      finished_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('crawl_sessions', ['site_id']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('crawl_sessions');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_crawl_sessions_status";');
    await queryInterface.removeColumn('sites', 'max_pages');
    await queryInterface.removeColumn('sites', 'max_depth');
  },
};
