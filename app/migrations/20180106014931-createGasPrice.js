'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query(`
      CREATE TABLE "gas_prices" (
        "block_number" integer NOT NULL PRIMARY KEY,
        "created" timestamp without time zone DEFAULT now() NOT NULL,
        "updated" timestamp without time zone DEFAULT now() NOT NULL,
        "safe_low" decimal NOT NULL CONSTRAINT safe_low_is_positive CHECK ("safe_low" > 0),
        average decimal NOT NULL,
        fastest decimal NOT NULL,
        CHECK (average >= "safe_low"),
        CHECK (fastest >= average)
      );
    `)
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`DROP TABLE "gas_prices"`)
  },
}
