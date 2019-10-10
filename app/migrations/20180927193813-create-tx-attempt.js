'use strict'
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      create type "onchain_tx_status" as ENUM('pending', 'mined', 'failed');
    `)

    await queryInterface.createTable('tx_attempts', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      created: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      nonce: {
        type: Sequelize.INTEGER,
      },
      sender_address: {
        type: Sequelize.BLOB,
      },
      gas: {
        type: Sequelize.INTEGER,
      },
      gas_price: {
        type: Sequelize.DECIMAL,
      },
      txhash: {
        type: Sequelize.BLOB,
        allowNull: true,
      },
      tx_id: {
        type: Sequelize.INTEGER,
      },
      status: {
        type: 'onchain_tx_status',
        defaultValue: 'pending',
      },
      network: {
        type: 'ethereum_network',
        allowNull: false,
      },
      block_number: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
    })
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`drop type onchain_tx_status;`)
    await queryInterface.dropTable('tx_attempts')
  },
}
