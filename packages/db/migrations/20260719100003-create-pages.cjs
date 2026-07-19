'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('pages', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      site_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'sites', key: 'id' },
        onDelete: 'CASCADE',
      },
      url: { type: Sequelize.TEXT, allowNull: false, unique: true },
      status: {
        type: Sequelize.ENUM('pending', 'crawled', 'failed', 'skipped'),
        allowNull: false,
        defaultValue: 'pending',
      },
      content_hash: { type: Sequelize.CHAR(64), allowNull: true },
      last_crawled_at: { type: Sequelize.DATE, allowNull: true },
      http_status: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('pages', ['site_id']);
    await queryInterface.addIndex('pages', ['status']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('pages');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_pages_status";');
  },
};
