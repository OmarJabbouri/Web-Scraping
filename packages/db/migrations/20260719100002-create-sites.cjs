'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('sites', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      base_url: { type: Sequelize.STRING, allowNull: false, unique: true },
      robots_txt: { type: Sequelize.TEXT, allowNull: true },
      crawl_delay_ms: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1000 },
      allowed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      render_mode: {
        type: Sequelize.ENUM('static', 'js'),
        allowNull: false,
        defaultValue: 'static',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('sites');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_sites_render_mode";');
  },
};
