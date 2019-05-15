// const supertest = require('supertest');
// const assert = require('assert');
const { expect } = require('chai');
const seed = require('./seed/seed.js');
const dao = require('../dao/dao.js');


describe('test dao module', async function(){
  before(async () => {
    await seed.insertFakeUser()
  })
  it('check users token', async function () {
    const result = await dao.singleSelect('user',{accessToken: seed.user[0].accessToken})
    expect(result[0]).to.include({id: 102149601017081,name: 'TestUser',email:'TestUser@gmail.com'});
  })
});
