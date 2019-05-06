'use strict';

/* eslint-disable max-len */
/* eslint-disable no-unused-expressions */

const expect = require('chai').expect;
const sinon = require('sinon');
const Serverless = require('../../../../../../../../Serverless');
const AwsProvider = require('../../../../../../provider/awsProvider');
const updateStage = require('./updateStage');

describe('#updateStage()', () => {
  let serverless;
  let options;
  let awsProvider;
  let providerGetAccountIdStub;
  let providerRequestStub;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.service.service = 'my-service';
    options = { stage: 'dev', region: 'us-east-1' };
    awsProvider = new AwsProvider(serverless, options);
    serverless.setProvider('aws', awsProvider);
    providerGetAccountIdStub = sinon.stub(awsProvider, 'getAccountId')
      .resolves(123456);
    providerRequestStub = sinon.stub(awsProvider, 'request');

    updateStage.serverless = serverless;
    updateStage.options = options;
    updateStage.provider = awsProvider;
  });

  afterEach(() => {
    awsProvider.getAccountId.restore();
    awsProvider.request.restore();
  });

  it('should perform updates if the REST API can be found', () => {
    updateStage.serverless.service.provider.tags = {
      foo: 'bar',
      bar: 'baz',
    };
    updateStage.serverless.service.provider.stackTags = {
      baz: 'qux',
    };
    updateStage.serverless.service.provider.tracing = {
      apiGateway: true,
    };
    updateStage.serverless.service.provider.apiGateway = {
      logs: true,
    };

    providerRequestStub.withArgs('APIGateway', 'getRestApis', { limit: 5000 })
      .resolves({
        items: [{ name: 'dev-my-service', id: 's0m31d' }],
      });

    return updateStage.updateStage().then(() => {
      const patchOperations = [
        { op: 'replace', path: '/tracingEnabled', value: 'true' },
        { op: 'replace', path: '/accessLogSettings/destinationArn', value: 'arn:aws:logs:us-east-1:123456:log-group:/aws/api-gateway/my-service-dev' },
        { op: 'replace', path: '/accessLogSettings/format', value: 'requestId: $context.requestId, ip: $context.identity.sourceIp, caller: $context.identity.caller, user: $context.identity.user, requestTime: $context.requestTime, httpMethod: $context.httpMethod, resourcePath: $context.resourcePath, status: $context.status, protocol: $context.protocol, responseLength: $context.responseLength' },
        { op: 'replace', path: '/*/*/logging/dataTrace', value: 'true' },
        { op: 'replace', path: '/*/*/logging/loglevel', value: 'INFO' },
        { op: 'replace', path: '/variables/baz', value: 'qux' },
        { op: 'replace', path: '/variables/foo', value: 'bar' },
        { op: 'replace', path: '/variables/bar', value: 'baz' },
      ];

      expect(providerGetAccountIdStub).to.be.calledOnce;
      expect(providerRequestStub.args[0][0]).to.equal('APIGateway');
      expect(providerRequestStub.args[0][1]).to.equal('getRestApis');
      expect(providerRequestStub.args[0][2]).to.deep.equal({ limit: 5000 });
      expect(providerRequestStub.args[1][0]).to.equal('APIGateway');
      expect(providerRequestStub.args[1][1]).to.equal('updateStage');
      expect(providerRequestStub.args[1][2]).to.deep.equal({
        restApiId: 's0m31d',
        stageName: 'dev',
        patchOperations,
      });
    });
  });

  it('should skip updates if stage settings are not configured', () => updateStage
    .updateStage().then(() => {
      expect(providerGetAccountIdStub).to.be.calledOnce;
      expect(providerRequestStub).not.to.be.called;
    }));
});