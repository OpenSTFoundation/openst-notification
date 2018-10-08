'use strict';
/**
 * Publish event to RabbitMQ.
 *
 * @module services/publish_event
 *
 */

const rootPrefix = '..',
  util = require(rootPrefix + '/lib/util'),
  validator = require(rootPrefix + '/lib/validator/init'),
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  rabbitMqHelper = require(rootPrefix + '/lib/rabbitmq/helper'),
  localEmitter = require(rootPrefix + '/services/local_emitter'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  apiErrorConfig = require(rootPrefix + '/config/api_error_config'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  paramErrorConfig = require(rootPrefix + '/config/param_error_config');

require(rootPrefix + '/lib/rabbitmq/helper');
require(rootPrefix + '/lib/rabbitmq/connect');

const errorConfig = {
  param_error_config: paramErrorConfig,
  api_error_config: apiErrorConfig
};

/**
 * Constructor to publish RMQ event
 *
 * @constructor
 */
const PublishEventKlass = function() {};

PublishEventKlass.prototype = {
  /**
   * Publish to rabbitMQ and local emitter also.
   *
   * @param {object} params - event parameters
   * @param {array} params.topics - on which topic messages
   * @param {object} params.message -
   * @param {string} params.message.kind - kind of the message
   * @param {object} params.message.payload - Payload to identify message and extra info.
   *
   * @return {Promise<result>}
   */
  perform: async function(params) {
    const oThis = this;

    // Validations.
    const r = await validator.light(params);
    if (r.isFailure()) {
      logger.error(r);
      return Promise.resolve(r);
    }

    const validatedParams = r.data,
      ex = 'topic_events',
      topics = validatedParams['topics'],
      msgString = JSON.stringify(validatedParams);
    let publishedInRmq = 0;

    // Publish local events.
    topics.forEach(function(key) {
      localEmitter.emitObj.emit(key, msgString);
    });

    let rmqId = rabbitMqHelper.getInstanceKey(oThis.ic().configStrategy),
      rabbitMqConnection = new oThis.ic().getRabbitMqConnection();

    // Publish RMQ events.
    const conn = await rabbitMqConnection.get(rmqId, true);

    if (conn) {
      publishedInRmq = 1;
      conn.createChannel(function(err, ch) {
        if (err) {
          let errorParams = {
            internal_error_identifier: 's_pe_2',
            api_error_identifier: 'cannot_create_channel',
            error_config: errorConfig,
            debug_options: { err: err }
          };
          logger.error(err.message);
          return Promise.resolve(responseHelper.error(errorParams));
        }

        //TODO: assertExchange and publish, Promise is not handled
        ch.assertExchange(ex, 'topic', { durable: true });
        topics.forEach(function(key) {
          ch.publish(ex, key, new Buffer(msgString), { persistent: true });
        });

        ch.close();
      });
    } else {
      logger.error('Connection not found writing to tmp.');
      util.saveUnpublishedMessages(msgString);
      let errorParams = {
        internal_error_identifier: 's_pe_1',
        api_error_identifier: 'no_rmq_connection',
        error_config: errorConfig,
        debug_options: {}
      };
      return Promise.resolve(responseHelper.error(errorParams));
    }

    return Promise.resolve(responseHelper.successWithData({ publishedToRmq: publishedInRmq }));
  }
};

PublishEventKlass.prototype.constructor = PublishEventKlass;

InstanceComposer.register(PublishEventKlass, 'getPublishEventKlass', true);

module.exports = PublishEventKlass;
