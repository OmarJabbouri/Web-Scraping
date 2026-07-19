'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('page_versions', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      page_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'pages', key: 'id' },
        onDelete: 'CASCADE',
      },
      version_no: { type: Sequelize.INTEGER, allowNull: false },
      raw_html: { type: Sequelize.TEXT, allowNull: false },
      content_hash: { type: Sequelize.CHAR(64), allowNull: false },
      fetched_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    // A page can be re-crawled many times; each crawl is a new row, never an update.
    await queryInterface.addIndex('page_versions', ['page_id', 'version_no'], {
      unique: true,
      name: 'page_versions_page_id_version_no_unique',
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('page_versions');
  },
};
