'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS vector;');
  },
  down: async (queryInterface) => {
    await queryInterface.sequelize.query('DROP EXTENSION IF EXISTS vector;');
  },
};
