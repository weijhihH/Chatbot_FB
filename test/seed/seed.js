const dao = require('../../dao/dao.js');
const user = [
  {
    id:102149601017081,
    name: 'TestUser',
    email: 'TestUser@gmail.com',
    accessToken: 'EAALux5Ptc6QBAIGqeUi8Kroku9KhfNbeaX6KYTz3ApJo1Mg66jee1t9CUL7xReuGZAmJk6WbIvif9eoHJzBordJHmaxFHoVIj7z2rcV8JyiKRFu1rDpuROv8jFvu41FSZBaZA9yvs3KDFPUT1joiNYy5sR5aZCNSSMIUBZCskpoF8M3X3LF2qgnKQZCwR3HTw5jHaEG6C84qEY8HH1fJaMZCXnS8BETnBwZD',
  }
]

module.exports = {
  async insertFakeUser(){
    try{
      await dao.del('user');
      const result = await dao.insert('user',user[0]);
      return result;
    } catch (error) {
      console.log({ error });
    }
  },
  user
};