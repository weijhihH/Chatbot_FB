const express = require('express');
const mysql = require('mysql');
const axios = require('axios');
const bodyParser = require('body-parser');
const cst = require('./util/constant.js');
const key = require('./util/key.js');

const app = express();

app.use(bodyParser.json());
app.use(express.static('public'));

// MySql Connected
const db = mysql.createPool({
  connectionLimit: 100,
  host: key.MYSQL.host,
  user: key.MYSQL.user,
  password: key.MYSQL.password,
  database: key.MYSQL.database,
});

// // 檢查各個 api 的 accessToken
// app.use(`/api/${cst.API_VERSION}/:id`,(req, res, next) => {
//   let accessToken = req.get('Authorization');
//   if (accessToken) {
//     accessToken = accessToken.replace('Bearer ', '');
//     db.query(`select * from user where accessToken = '${accessToken}';`, (error, result) => {
//       if (error) {
//         res.send({ error: 'DB error' });
//         throw error;
//       } else if (result.length !== 0 && result[0].expiredTime - Date.now() > 0) {
//         next();
//       } else {
//         res.send({ error: 'AccessToken was not matched in DB' });
//       }
//     });
//   } else {
//     res.send({ error: 'AccessToken was not found' });
//   }
// });

// 由 facebook api 找到個人擁有的 page list
function findPagesList(req) {
  return new Promise((resolve, reject) => {
    const accessToken = req.get('Authorization');
    console.log('123213213: ', accessToken)
    // accessToken = accessToken.replace('Bearer ', '');
    axios.get('https://graph.facebook.com/me/accounts', { headers: { Authorization: accessToken } })
      .then((res) => {
        console.log('666',res)
        resolve(res);
      })
      .catch((error) => {
        console.log('777',error.message);
        reject(error.message);
      });
  });
}

// 處理 facebook weebhook 訂閱事件
function pageSubscribed(data) {
  return new Promise((resolve, reject) => {
    // console.log(data)
    const arrayPromise = [];
    data.forEach((arr) => {
      // console.log('forEachLoop', arr);
      arrayPromise.push(axios({
        method: 'POST',
        url: `https://graph.facebook.com/${arr.id}/subscribed_apps`,
        headers: { Authorization: `Bearer ${arr.access_token}` },
        data: {
          subscribed_fields: 'messages, messaging_postbacks, message_reads, messaging_checkout_updates',
        },
      }).then((res) => {
        console.log('response messages form FacebookPageSubscribed: ', res.data);
        return (res.data);
      }).catch((error) => {
        console.log('error messages form FacebookPageSubscribed: ', error.data);
        reject(error.response.data);
      }));
    });
    Promise.all(arrayPromise)
      .then((res) => {
        resolve(res);
      });
  });
}

// 找 pages 內所有資訊
function selectPagesInfromation() {
  db.query('select * from pages', (error, result) => {
    if (error) throw error;
    return (result);
  });
}

// 將會員資訊存入DB
app.get(`/api/${cst.API_VERSION}/signin`, (req, res) => {
  let accessToken = req.get('Authorization');
  accessToken = accessToken.replace('Bearer ', '');
  const url = `https://graph.facebook.com/me?fields=id,name,email&access_token=${accessToken}`;
  const expiredTime = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 day
  axios.get(url)
    .then((response) => {
    // 由 fb api 取得個人資訊
      const data = {
        id: response.data.id,
        name: response.data.name,
        email: response.data.email,
        accessToken,
        expiredTime,
      };
      return data;
    }).then((profile) => {
      // 將個人資訊存成入 DB , 並且回傳 cookie
      db.getConnection((err, connection) => {
        if (err) throw err;
        connection.query(`select * from user where id = '${profile.id}';`, (err, result) => {
          if (err) {
            connection.release();
            res.send({ error: 'Invalid Token' });
          } else if (result.length === 0) {
            // DB 找不到會員資料, 新增一筆
            connection.beginTransaction((error) => {
              if (error) {
                connection.release();
              }
              res.send({ error: 'Database Query Error' });
              connection.query('insert into user set?', profile, (error) => {
                connection.release();
                if (error) {
                  res.send({ error: 'Database Query Error' });
                  return connection.rollback();
                }
                connection.commit((error) => {
                  if (error) {
                    return connection.rollback(() => {
                      res.send({ error: 'Database Query Error' });
                      throw error;
                    });
                  }
                  res.cookie('Authorization', profile.accessToken);
                  res.send({ data: profile });
                });
              });
            }); // Mysql Transaction
          } else if (result.length !== 0) {
            // DB 有會員資料, 故更新資料庫
            connection.query('update user set ?', profile, (error) => {
              connection.release();
              if (error) {
                res.send({ error: 'Database Query Error' });
                return connection.rollback();
              }
              connection.commit((error) => {
                if (error) {
                  return connection.rollback(() => {
                    res.send({ error: 'Database Query Error' });
                    throw error;
                  });
                }
                res.cookie('Authorization', profile.accessToken);
                res.send({ data: profile });
              });
            });
          }
        });
      });
    }).catch((error) => {
      console.log('error:', error);
    });
});

//訂閱
//pageSubscribed
//存資料庫

app.get(`/api/${cst.API_VERSION}/profile`, async (req, res) => {
  const accessToken = req.get('Authorization');
  try {
    // 用 facebook accessToken 找到對應個人有幾個粉絲頁(fb page)
    const findPagesListResult = await findPagesList(req);
    const pageLists = findPagesListResult.data.data;
    // 取得長期權杖 
    const longLivedToken = await getLongLivedToken(pageLists);
    console.log('222: ', longLivedToken)
    // 將資料存入DB , id(user,foreign key),page_id,page_name,page_accessToken,expired_in
    //
    // longLivedToken
    console.log('123',longLivedToken)
    // const result = await pageSubscribed(pageLists);
    res.send({ data: pageLists });
  } catch (error) {
    res.send({ error: error.error });
  }
});




// get facebook Long-lived token
// GET / https://graph.facebook.com/oauth/access_token
// client_id, client_secret, grant_type= fb_exchange_token, fb_exchange_token
// Expires time from 2 hours extend to 2 mounths.
// FB PageAccessToken exchange to long-lived token from short-lived token
function getLongLivedToken(pageListsArray) {
  return new Promise((resolve,reject) =>{
    const arrayPromise = [];
    pageListsArray.forEach((arr) =>{
      arrayPromise.push(axios({
        method: 'GET',
        url: 'https://graph.facebook.com/oauth/access_token',
        params: {
          client_id: key.FB.APP_Client_ID,
          client_secret: key.FB.APP_SECRECT_KEY,
          grant_type: 'fb_exchange_token',
          fb_exchange_token: arr.access_token,
        },
      }).then((res) => {
        console.log('res data for getLongLivedToken', res.data);
        return(res.data);
      }).catch((error) => {
        console.log('error for getLongLivedToken', error);
        reject(error);
      }));
    });
    Promise.all(arrayPromise)
    .then((res) => {
      resolve(res);
    });
  });
}

// Creates the endpoint for our webhook 
app.post('/webhook', (req, res) => {  
  const VERIFY_TOKEN = PAGE_ACCESS_TOKEN;
  // Parse the request body from the POST
  let body = req.body;

  // Check the webhook event is from a Page subscription
  if (body.object === 'page') {

    body.entry.forEach(function(entry) {

      // Gets the body of the webhook event
      let webhook_event = entry.messaging[0];
      console.log(webhook_event);
    
      // Get the sender PSID
      let sender_psid = webhook_event.sender.id;
      console.log('Sender PSID: ' + sender_psid);
    
    });

    // Return a '200 OK' response to all events
    res.status(200).send('EVENT_RECEIVED');

  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});


// Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {

  // Your verify token. Should be a random string.
  let VERIFY_TOKEN = PAGE_ACCESS_TOKEN;
    
  // Parse the query params
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];
    
  // Checks if a token and mode is in the query string of the request
  if (mode && token) {
  
    // Checks the mode and token sent is correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      
      // Responds with the challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);      
    }
  }
});


//測試用
app.get('/test', (req,res) =>{
  console.log('req: ',req.body);
  res.send({data:'test api'});
})

app.listen('3001', () => {
  console.log('Server connected on port 3001');
});

// Mysql
