'use strict'
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      CREATE DOMAIN ethereum_transaction_id
      AS bytea
      CONSTRAINT hash_length
      CHECK ((VALUE = NULL) OR (octet_length(VALUE) = 32));
    `)

    await queryInterface.sequelize.query(`
      CREATE DOMAIN ethereum_address
      AS bytea
      CONSTRAINT address_length
      CHECK (octet_length(VALUE) = 20);
    `)

    await queryInterface.sequelize.query(`
      create type "tx_status" as ENUM('pending', 'broadcast' ,'mined', 'failed');
    `)

    await queryInterface.sequelize.query(`
      create type "ethereum_network" as ENUM('mainnet','rinkeby','local','kovan','sokol','ropsten');
    `)

    await queryInterface.sequelize.query(`
      create table txs (

        "id" serial primary key,
        "created" timestamp without time zone default now() not null,
        "updated" timestamp without time zone default now() not null,

        "network" ethereum_network not null,
        "contract_name" varchar(256) not null,
        "contract_address" ethereum_address not null,
        "sender_address" ethereum_address not null,
        "method" varchar(256) not null,
        "args" jsonb not null,

        -- "signedtx" bytea not null,

        "estimate_retries" int not null default 0,
        "max_estimate_retries" int not null default 100,
        "status" tx_status not null default 'pending',
        "webhook" jsonb not null,

        "txhash" ethereum_transaction_id,

        "blocking_txs" text[] default ARRAY[]::text[]
      );
    `)
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      drop table txs;
    `)
    await queryInterface.sequelize.query(`
      drop type tx_status;
    `)
    await queryInterface.sequelize.query(`
      drop domain if exists ethereum_address;
    `)
    await queryInterface.sequelize.query(`
      drop domain if exists ethereum_transaction_id;
    `)
  },
}
