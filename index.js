'use strict';

/**
 * Load OST Notification module.
 */

const rootPrefix = '.',
  version = require(rootPrefix + '/package.json').version,
  rabbitmqHelper = require(rootPrefix + '/lib/rabbitmq/helper'),
  OSTBase = require('@ostdotcom/base'),
  coreConstant = require(rootPrefix + '/config/coreConstant');

const InstanceComposer = OSTBase.InstanceComposer;

require(rootPrefix + '/lib/rabbitmq/helper');
require(rootPrefix + '/lib/rabbitmq/connection');
require(rootPrefix + '/services/publishEvent');
require(rootPrefix + '/services/subscribeEvent');

require(rootPrefix + '/services/fanOut/publish');

/**
 * OST Notification
 *
 * @param configStrategy
 * @constructor
 */
const OSTNotification = function(configStrategy) {
  const oThis = this;

  if (!configStrategy) {
    throw 'Mandatory argument configStrategy missing.';
  }

  const instanceComposer = (oThis.ic = new InstanceComposer(configStrategy));

  oThis.version = version;
  oThis.connection = instanceComposer.getInstanceFor(coreConstant.icNameSpace, 'rabbitmqConnection');
  oThis.publishEvent = instanceComposer.getInstanceFor(coreConstant.icNameSpace, 'publishEvent');
  oThis.subscribeEvent = instanceComposer.getInstanceFor(coreConstant.icNameSpace, 'subscribeEvent');

  // oThis.fanoutPublishEvent = instanceComposer.getInstanceFor(coreConstant.icNameSpace, 'FanoutPublishEvent');
};

// Instance Map to ensure that only one object is created per config strategy.
const instanceMap = {};

const OSTNotificationFactory = function() {};

OSTNotificationFactory.prototype = {
  /**
   * Get an instance of OSTNotification
   *
   * @param configStrategy
   * @returns {OSTNotification}
   */
  getInstance: function(configStrategy) {
    const oThis = this,
      rabbitMqMandatoryParams = ['username', 'password', 'host', 'port', 'heartbeats'];

    if (!configStrategy.hasOwnProperty('rabbitmq')) {
      throw 'RabbitMQ one or more mandatory connection parameters missing.';
    }

    // Check if all the mandatory connection parameters for RabbitMQ are available or not.
    for (let key = 0; key < rabbitMqMandatoryParams.length; key++) {
      if (!configStrategy.rabbitmq.hasOwnProperty(rabbitMqMandatoryParams[key])) {
        throw 'RabbitMQ one or more mandatory connection parameters missing.';
      }
    }

    // Check if instance already present.
    let instanceKey = rabbitmqHelper.getInstanceKey(configStrategy),
      _instance = instanceMap[instanceKey];

    if (!_instance) {
      _instance = new OSTNotification(configStrategy);
      instanceMap[instanceKey] = _instance;
    }
    _instance.connection.get();

    return _instance;
  }
};

const factory = new OSTNotificationFactory();
OSTNotification.getInstance = function() {
  return factory.getInstance.apply(factory, arguments);
};

module.exports = OSTNotification;
