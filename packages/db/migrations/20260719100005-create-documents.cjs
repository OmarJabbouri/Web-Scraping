'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('documents', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      page_version_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'page_versions', key: 'id' },
        onDelete: 'CASCADE',
      },
      title: { type: Sequelize.TEXT, allowNull: true },
      cleaned_text: { type: Sequelize.TEXT, allowNull: false },
      // Non-article content (tables, extracted links, ...) lives here as JSON.
      structured_data: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      content_type: { type: Sequelize.STRING(50), allowNull: false, defaultValue: 'article' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('documents');
  },
};
