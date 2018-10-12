'use strict';

const ExternalTaskRepository = require('./dist/commonjs/index').ExternalTaskRepository;

function registerInContainer(container) {

  container.register('ExternalTaskRepository', ExternalTaskRepository)
    .configure('process_engine:external_task_repository')
    .singleton();
}

module.exports.registerInContainer = registerInContainer;
