/* eslint-disable camelcase */
/* eslint-disable no-plusplus */
const express = require('express');
// const mysql = require('mysql');
const axios = require('axios');
const bodyParser = require('body-parser');
const cst = require('./util/constant.js');
const key = require('./util/key.js');
const dao = require('./dao/dao.js');
const mysqlcon = require('./util/mysqlCon.js');

const db = mysqlcon.con1;
const app = express();

app.use(bodyParser.json());
app.use(express.static('public'));

// 檢查 accessToken and expired, lognin api 沒檢查
app.use(`/api/${cst.API_VERSION}/:pageId`, async (req, res, next) => {
  try {
    let accessToken = req.get('Authorization');
    accessToken = accessToken.replace('Bearer ', '');
    if (accessToken) {
      const table = 'user';
      const checkResult = await dao.singleSelect(table, { accessToken });
      const accessTokenexpired = checkResult[0].expiredTime - Date.now();
      if (checkResult.length !== 0 && accessTokenexpired > 0) {
        next();
        return true;
      }
      return res.send({ error: 'AccessToken was not matched in DB' });
    }
    return res.send({ error: 'AccessToken was not found' });
  } catch (err) {
    return res.send({ error: 'Some Error Happened' });
  }
});

// 由 facebook api 找到個人擁有的 page list
function findPagesList(accessToken) {
  return new Promise((resolve, reject) => {
    axios.get('https://graph.facebook.com/me/accounts', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => {
        if (res.data.data.length === 0) {
          return reject(new Error('can\'t get page list'));
        }
        return resolve(res);
      })
      .catch(error => reject(new Error(error)));
  });
}

// 處理 facebook weebhook 訂閱事件, page 訂閱
function pageSubscribed(data) {
  return new Promise((resolve, reject) => {
    const arrayPromise = [];
    data.forEach((arr) => {
      const pageId = arr.id;
      const accessToken = arr.access_token;
      arrayPromise.push(axios({
        method: 'POST',
        url: `https://graph.facebook.com/${pageId}/subscribed_apps`,
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          subscribed_fields: 'messages, messaging_postbacks, message_reads, messaging_checkout_updates',
        },
      }).then(res => res.data)
        .catch(error => error.response.data));
    });
    Promise.all(arrayPromise)
      .then(res => resolve(res))
      .catch(err => reject(err));
  });
}

app.get('/api/signin', async (req, res) => {
  try {
    let accessToken = req.get('Authorization');
    accessToken = accessToken.replace('Bearer ', '');
    const url = `https://graph.facebook.com/me?fields=id,name,email&access_token=${accessToken}`;
    const expiredTime = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 day
    const userDataFromFB = await axios.get(url);
    const profile = {
      id: parseInt(userDataFromFB.data.id),
      name: userDataFromFB.data.name,
      email: userDataFromFB.data.email,
      accessToken,
      expiredTime,
    };

    await dao.signIn(profile);
    res.cookie('Authorization', profile.accessToken);
    res.send({ data: profile });
  } catch (error) {
    res.send(error);
  }
});

// // 將 page資訊存入資料庫
async function storePageInformation(pageLists, longLivedToken, accessToken) {
  return new Promise((resolve, reject) => {
    const promiseArr = [];
    promiseArr.push(pageLists.forEach((page, i) => {
      const pageId = page.id;
      const dataInputDB = {
        pageName: page.name,
        pageId: page.id,
        pageAccessToken: longLivedToken[i].access_token,
      };
      // console.log('dataInputDB',dataInputDB);
      dao.pageDataToDB(accessToken, pageId, dataInputDB);
    }));
    Promise.all(promiseArr)
      .then(() => resolve(true))
      .catch(error => reject(error));
  });
}

// get facebook Long-lived token
// GET / https://graph.facebook.com/oauth/access_token
// client_id, client_secret, grant_type= fb_exchange_token, fb_exchange_token
// Expires time from 2 hours extend to 2 mounths.
// FB PageAccessToken exchange to long-lived token from short-lived token
function getLongLivedToken(pageListsArray) {
  return new Promise((resolve, reject) => {
    const arrayPromise = [];
    pageListsArray.forEach((arr) => {
      arrayPromise.push(axios({
        method: 'GET',
        url: 'https://graph.facebook.com/oauth/access_token',
        params: {
          client_id: key.FB.APP_Client_ID,
          client_secret: key.FB.APP_SECRECT_KEY,
          grant_type: 'fb_exchange_token',
          fb_exchange_token: arr.access_token,
        },
      }).then(res => (res.data))
        .catch(error => reject(new Error(error))));
    });
    Promise.all(arrayPromise)
      .then((res) => {
        resolve(res);
      })
      .catch(error => reject(new Error(error)));
  });
}


app.get(`/api/${cst.API_VERSION}/profile`, async (req, res) => {
  let accessToken = req.get('Authorization');
  accessToken = accessToken.replace('Bearer ', '');
  try {
    // 用 facebook accessToken 找到有幾個粉絲頁(fb page)
    const findPagesListResult = await findPagesList(accessToken);
    const pageLists = findPagesListResult.data.data;
    // 取得長期權杖
    const longLivedToken = await getLongLivedToken(pageLists);
    // 將資料存入DB , id(user,foreign key),page_id,page_name,page_accessToken,expired_time,longLivedToken
    await storePageInformation(pageLists, longLivedToken, accessToken);
    // 向 facebook 訂閱 page;
    await pageSubscribed(pageLists);
    res.send({ data: pageLists });
  } catch (error) { res.send({ error }); }
});

// Greeting Message 內容讀取
app.get(`/api/${cst.API_VERSION}/webhook/greeting/:pageId`, async (req, res) => {
  // console.log(req.query.pageId);
  const { pageId } = req.query;
  const table = 'greetingMessage';
  const condition = { pageId };
  try {
    const checkGreetingMessageResult = await dao.singleSelect(table, condition);
    if (checkGreetingMessageResult.length === 0) {
      res.send({ data: 'NoData' });
    } else {
      res.send({ data: checkGreetingMessageResult[0].text });
    }
  } catch (error) {
    res.send({ error: 'someting error happened' });
  }
});

// Greeting Message 內容寫入
app.post(`/api/${cst.API_VERSION}/webhook/greeting`, async (req, res) => {
  const { pageId } = req.body.data;
  const greetingText = req.body.data.text;
  const requestBody = {
    get_started: {
      payload: 'getStarted',
    },
    greeting: [
      {
        locale: 'default',
        text: greetingText,
      },
    ],
  };
  try {
    // 檢查資料不能為空值, 將字串去除空白符號
    const inputChecked = greetingText.trim();
    // 卡資料不能為空值
    if (!inputChecked) {
      throw new Error('input Error');
    }
    // Find pageAccessToken
    const pageSelectResult = await dao.singleSelect('pages', { pageId });
    const { pageAccessToken } = pageSelectResult[0];
    // 在 facebook 伺服器設定打招呼用語
    await fetchSetGreeting(pageAccessToken, requestBody);
    // 判別資料是否已經在資料庫存在
    const checkGreetingMessageResult = await dao.singleSelect('greetingMessage', { pageId });
    // 將資料存入資料庫
    const dataIntoGreetingMessageDB = {
      pageId,
      text: greetingText,
    };
    if (checkGreetingMessageResult.length === 0) {
      // insert new data into db
      await dao.insert('greetingMessage', dataIntoGreetingMessageDB);
      res.send({ data: 'Inserted to DB' });
    } else {
      // update data
      await dao.update('greetingMessage', dataIntoGreetingMessageDB, { pageId });
      res.send({ data: 'Updated to DB' });
    }
  } catch (error) {
    res.status(500).send({ error: 'Something failed!' });
  }

  function fetchSetGreeting(pageAccessToken, request) {
    return new Promise((resolve, reject) => {
      axios({
        method: 'POST',
        url: 'https://graph.facebook.com/v3.2/me/messenger_profile',
        headers: {
          Authorization: `Bearer ${pageAccessToken}`,
          'Content-Type': 'application/json',
        },
        data: request,
      }).then(res => resolve(res.data))
        .catch(error => reject(error.data));
    });
  }
});

// 進資料庫用 pageId 找 page's accessToken
function dbFindPageAccessToken(pageId) {
  return new Promise((resolve, reject) => {
    db.query(`select * from pages where pageId = '${pageId}'`, (err, result) => {
      if (err) {
        reject(err);
      }
      resolve(result[0].pageAccessToken);
    });
  });
}

app.get(`/api/${cst.API_VERSION}/webhook/wellcomeMessage/:pageId`, async (req, res) => {
  const condition = {
    pageId: req.query.pageId,
    payload: req.query.payload,
  };
  const wellcomeMessageSelectResult = await dao.singleSelect('sendMessage', { pageId: condition.pageId }, 'and', { payload: condition.payload });
  if (wellcomeMessageSelectResult.length === 0) {
    res.send({ data: 'NoData' });
  } else {
    res.send({ data: wellcomeMessageSelectResult[0] });
  }
});


app.post(`/api/${cst.API_VERSION}/webhook/wellcomeMessage`, async (req, res) => {
  try {
    const response = req.body;
    await inputDataValidator(response);
    const info = {
      attachment: {
        type: 'template',
        payload: {
          template_type: response.data.message_type,
          text: response.data.text,
          buttons: response.data.buttons,
        },
      },
    };
    const queryInput = {
      pageId: response.pageId,
      position: response.position,
      handleType: response.handleType,
      event: response.event,
      payload: response.payload,
      source: response.source,
      info: JSON.stringify(info),
    };
    const table = 'sendMessage';
    const { pageId } = queryInput;
    const { payload } = queryInput;
    const queryResultForPageId = await dao.singleSelect(table, { pageId }, 'and', { payload });
    if (queryResultForPageId.length === 0) {
      // 資料庫中無資料, 需存入一筆新的
      await dao.insert(table, queryInput);
    } else {
      // 資料庫中有資料, 更新現有資料
      await dao.update(table, queryInput, { pageId }, 'and', { payload });
    }
    res.send({ data: 'data has been updated' });
  } catch (error) {
    res.send({ error });
  }

  // 驗證輸入資料正確性
  async function inputDataValidator (input) {
    try{
      if (!input.pageId || input.source !== 'wellcomeMessage' || input.handleType !== 'postback' || input.event !== 'attachment' || input.payload !=='getStarted' || input.data.message_type !=='button' || !input.data.text) {
        throw new Error ('data format error')
      }
      for (let i = 0; i<input.data.buttons.length ; i++) {
        console.log(input.data.buttons[i]);
        if(input.data.buttons[i].type === 'postback') {
          if(!input.data.buttons[i].payload.trim()){
            throw new Error ('data format error')
          }
        } else if (input.data.buttons[i].type === 'web_url') {
          if(!input.data.buttons[i].url.trim()){
            throw new Error ('data format error')
          } else if(!is_url(input.data.buttons[i].url)){
            throw new Error ('data format error')
          }
        } else if(!input.data.buttons[i].type || input.data.buttons[i].type === '按鈕類型') {
          throw new Error ('data format error')
        }
      }
      return true
    } catch (error) {
      throw new Error(error)
    }
  };
}); // end of Wellcome Message

// 判斷 url 輸入進來是否合法
function is_url(str)
{
  regexp =  /^(?:(?:https?|ftp):\/\/)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/\S*)?$/;
    if (regexp.test(str))
    {
      return true;
    }
    else
    {
      return false;
    }
}

app.get(`/api/${cst.API_VERSION}/webhook/moreSetting/:pageId`, async (req, res) => {
  try {
    const { pageId } = req.query;
    const source = { source: 'moreSetting' };
    const table = 'sendMessage';
    const queryResult = await dao.singleSelect(table, { pageId }, 'and', source);
    if (queryResult.length === 0) {
      res.send({ data: 'NoData' });
    } else {
      res.send({ data: queryResult });
    }
  } catch (error) {
    res.send({ error: 'someting error happened' });
  }
});

// 讀取 db 資料給前端 - people profile
app.get(`/api/${cst.API_VERSION}/webhook/people/:pageId`, async (req, res) => {
  const { pageId } = req.query;
  const table = 'people';
  const selectQueryResult = await dao.singleSelect(table, { pageId });
  res.send({ data: selectQueryResult });
});


app.get(`/api/${cst.API_VERSION}/broadcast/:pageId`, async (req, res) => {
  try {
    const { pageId } = req.query;
    const source = { source: 'broadcast' };
    const selectQueryInSendmessageResult = await dao.singleSelect('sendMessage', { pageId }, 'and', source);
    if (selectQueryInSendmessageResult.length === 0) {
      res.send({ data: 'NoData' });
    } else {
      const selectQuerybroadcastSetResult = await dao.singleSelect('broadcastSet', { pageId });
      if (selectQuerybroadcastSetResult[0].repeat === 0) {
        res.send({
          data: selectQueryInSendmessageResult,
          broadcast: selectQuerybroadcastSetResult,
        });
      } else {
        const selectQuerybroadcastRepeatResult = await dao.SelectRuleLeftJoinbroadcastRepeatTable(pageId);
        const repeatDate = [];
        selectQuerybroadcastRepeatResult.forEach((e) => {
          repeatDate.push(e.rule);
        });
        res.send({
          data: selectQueryInSendmessageResult,
          broadcast: selectQuerybroadcastSetResult,
          repeatDate,
        });
      }
    }
  } catch (error) {
    res.send({ error: 'something error happened' });
  }
});

// 20190513

// 將 broadcast 設定資料存入資料庫中
app.post(`/api/${cst.API_VERSION}/broadcast`, async (req, res) => {
  const response = req.body;
  const source = 'broadcast';
  const { pageId } = response.data[0];
  const { repeatDate } = response.data[0];
  // 判別是否 broadcast date 是否有週期性
  let repeat;
  if (response.data[0].repeatDate.length === 0) {
    repeat = false;
  } else {
    repeat = true;
  }
  // broadcastSetContent 內容寫入
  const broadcastSetContent = {
    pageId: response.data[0].pageId,
    startDate: response.data[0].date,
    startTime: response.data[0].time,
    timezone: response.data[0].timezone,
    repeat,
  };
  const broadcastRepeatContent = broadcastRepeatInputContent(pageId, repeatDate);
  try {
    // 整理要寫入 db 的資料 (整理寫進 sendMessage table)
    const sendMessageTableinput = await insertContent(response.data);
    await dao.broadcastDataUpdated(pageId, sendMessageTableinput, source, broadcastSetContent, broadcastRepeatContent);
    res.send({ data: 'data has been saved' });
  } catch (error) {
    res.send({ error: 'error in DB' });
  }
});







// 更多設定頁面 api
app.post(`/api/${cst.API_VERSION}/webhook/moreSetting`, async (req, res) => {
  const response = req.body;
  const source = 'moreSetting';
  const { pageId } = response.data[0];
  try {
    for(let i=0; i< response.data.length; i++) {
      if(response.data[i].event === 'message') {
        await messageDataValidator(response.data[i])
      } else if (response.data[i].event === 'attachment') {
        await buttonTemplateDataValidator(response.data[i]);
      }
    }
    // 整理要寫入 db 的資料
    const sendMessageTableinput = await insertContent(response.data);
    // 寫入資料庫
    await dao.moreSeetingDataUpdated(pageId, sendMessageTableinput, source);
    res.send({ data: 'data has been saved' });
  } catch (error) {
    res.send({ error: 'error has happened' });
  }

  async function messageDataValidator(input) {
    if(!input.pageId || !input.payload.trim() || !input.handleType.trim() || !input.message.text.trim()) {
      throw new Error ('data format wrong')
    }
  } // end of messageDataValidator

  async function buttonTemplateDataValidator (input) {
    try{
      if (!input.pageId || input.source !== 'moreSetting' || input.handleType !== 'postback' || input.event !== 'attachment' || !input.payload.trim() || input.message.template_type !=='button' || !input.message.text.trim()) {
        throw new Error ('data format error')
      }
      for (let i = 0; i<input.message.buttons.length ; i++) {
        if(input.message.buttons[i].type === '按鈕類型' || !input.message.buttons[i].title.trim() ) {
          throw new Error ('data format error')
        }
        if(input.message.buttons[i].payload){
          if(!input.message.buttons[i].payload.trim()){
            throw new Error ('data format error')
          }
        } else if (input.message.buttons[i].url) {
          if(!input.message.buttons[i].url.trim()){
            throw new Error ('data format error')
          } else if (!is_url(input.message.buttons[i].url)){
            throw new Error ('data format error')
          }
        }  else if (!input.message.buttons[i].payload && !input.message.buttons[i].url) {
          throw new Error ('data format error')
        }
      }
      return true
    } catch (error) {
      throw new Error(error)
    }
  }; // end of buttonTemplateDataValidator
}); // end of moreSetting post api

// 整理前端送進來的資料 - moreSetting/broadcast 使用
function insertContent(input) {
  const content = [];
  return new Promise((resolve) => {
    input.forEach((e) => {
      const arr = [e.pageId, e.position, e.handleType, e.event, e.payload, e.source];
      if (e.event === 'message') {
        arr.push(JSON.stringify(e.message));
      } else if (e.event === 'attachment') {
        const info = JSON.stringify({
          attachment: {
            type: 'template',
            payload: {
              template_type: e.message.template_type,
              text: e.message.text,
              buttons: e.message.buttons,
            },
          },
        });
        arr.push(info);
      }
      content.push(arr);
      return resolve(content);
    });
  });
}

// 將 broadcast repeat setting 存入 broadcastRepeat 內
function broadcastRepeatInputContent(pageId, input) {
  const insertContent = [];
  input.forEach((e) => {
    switch (e) {
      case 'sunday':
        insertContent.push([pageId, 7]);
        break;
      case 'monday':
        insertContent.push([pageId, 1]);
        break;
      case 'tuesday':
        insertContent.push([pageId, 2]);
        break;
      case 'wednesday':
        insertContent.push([pageId, 3]);
        break;
      case 'thursday':
        insertContent.push([pageId, 4]);
        break;
      case 'friday':
        insertContent.push([pageId, 5]);
        break;
      case 'saturday':
        insertContent.push([pageId, 6]);
        break;
      default:
        break;
    }
  });
  return insertContent;
}

async function insetProfileToDb(psid, pageAccessToken, pageId, lastSeenTime) {
  try {
    // 1.找資料庫有無相符合的資料 PSID
    const queryResult = await selectPSIDFromDb(psid);
    if (queryResult.length > 0) {
      // 2-a. 有找到資料, 將 lastSeen 資料更新到資料庫中
      const updateToDbResult = await updatelastSeenToDb(lastSeenTime, psid);
      return updateToDbResult;
    }
    // 2-b. 無找到資料, 跟 fb 要個人資料, 並且存入到資料庫中
    const getProfile = await getProfileFromFb(psid, pageAccessToken);
    await insertNewProfileToDb(getProfile, pageId, lastSeenTime);
    // 第一次建立完資料, 順便把 pageId 綁定 label (綁定區域&性別&時區)
    const checkLabelsResult = await checkLabels(getProfile);
    // console.log('checkLabelsResult', checkLabelsResult);
    if (checkLabelsResult.length !== 0) {
      const addUserToFacebookLabelsResult = await addUserToFacebookLabels(checkLabelsResult, pageAccessToken, psid);
      return addUserToFacebookLabelsResult;
    }
    return 'no Update Data';
  } catch (error) {
    return error;
  }
}

// 確認資料庫有無現成的資料 - labels
function checkLabels(getProfile) {
  return new Promise((resolve, reject) => {
    const { data } = getProfile;
    const query = `select * from labels where label_name = 'locale${data.locale}' or 
    label_name = 'genderIs${data.gender}' or label_name = 'timezone${data.timezone}'`;
    db.query(query, (err, result) => {
      if (err) {
        return reject(err);
      }
      return resolve(result);
    });
  });
}

// 將使用者加入標籤
// Broadcast 群發給特定的群組用,綁標籤
function addUserToFacebookLabels(response, accessToken, psid) {
  return new Promise((resolve, reject) => {
    const promiseArr = [];
    response.forEach((arr) => {
      promiseArr.push(axios({
        method: 'POST',
        url: `https://graph.facebook.com/v2.11/${arr.label_id}/label?access_token=${accessToken}`,
        data: {
          user: psid,
        },
      })
        .then(res => res.data)
        .catch(err => (err.response.data)));
    });
    Promise.all(promiseArr)
      .then((res) => {
        resolve(res);
      })
      .catch((err) => {
        reject(err);
      });
  });
}

// 將資料存入資料庫
function insertNewProfileToDb(getProfile, pageId, lastSeenTime) {
  return new Promise((resolve, reject) => {
    const query = 'insert into people set ?';
    const { data } = getProfile;
    const content = {
      pageId,
      PSID: data.id,
      name: data.name,
      locale: data.locale,
      timezone: data.timezone,
      gender: data.gender,
      lastSeen: lastSeenTime,
      signedUp: lastSeenTime,
    };
    db.query(query, content, (err, result) => {
      if (err) {
        return reject(err);
      }
      return resolve(result);
    });
  });
}

// 將資料update進資料庫
function updatelastSeenToDb(lastSeenTime, psid) {
  return new Promise((resolve, reject) => {
    const query = `update people set ? where PSID = '${psid}'`;
    const content = {
      lastSeen: lastSeenTime,
      times: 1,
    };
    db.query(query, content, (err, result) => {
      if (err) {
        return reject(err);
      }
      return resolve(result);
    });
  });
}

// 確認資料庫有無 psid
function selectPSIDFromDb(psid) {
  return new Promise((resolve, reject) => {
    const query = `select * from people where PSID = '${psid}'`;
    db.query(query, (err, result) => {
      if (err) {
        return reject(err);
      }
      return resolve(result);
    });
  });
}

// 跟 fb 要資料 (user profile)
function getProfileFromFb(psid, pageAccessToken) {
  return new Promise((resolve, reject) => {
    const fields = 'name,profile_pic,locale,timezone,gender';
    const url = `https://graph.facebook.com/${psid}?fields=${fields}&access_token=${pageAccessToken}`;
    axios({
      method: 'GET',
      url,
    }).then(res => resolve(res)).catch(err => reject(err));
  });
}

// Creates the endpoint for webhook -- 接收 facebook 訊息
app.post('/webhook', async (req, res) => {
  // console.log('message', req.body.entry);

  // Parse the request body from the POST
  const { body } = req;
  const pageId = req.body.entry[0].id;
  const psid = req.body.entry[0].messaging[0].sender.id;
  const lastSeenTime = parseInt(req.body.entry[0].time, 10);
  // use pageId to get facebook accesstoken
  try {
    const pageAccessToken = await dbFindPageAccessToken(pageId);
    // console.log('abcde:', body.object);

    await insetProfileToDb(psid, pageAccessToken, pageId, lastSeenTime);

    // Check the webhook event is from a Page subscription
    if (body.object === 'page') {
      body.entry.forEach(async (entry) => {
        // Gets the body of the webhook event
        const webhook_event = entry.messaging[0];
        // console.log('webhook_event', webhook_event);
        // Get the sender PSID
        const sender_psid = webhook_event.sender.id;
        // console.log('Sender PSID: ' + sender_psid);

        // Check if the event is a message or postback and
        // pass the event to the appropriate handler function
        let response;
        if (webhook_event.message) {
          response = await handleMessage(pageId, webhook_event.message);
          // callSendAPI(sender_psid, response, pageAccessToken)
          callSendAPI(sender_psid, response, pageAccessToken);
        } else if (webhook_event.postback) {
        // response 包裝成 array , 要考慮可能一次回超過一句
          response = await handlePostback(pageId, webhook_event.postback);
          callSendAPI(sender_psid, response, pageAccessToken);
        }
      });

      // Return a '200 OK' response to all events
      res.status(200).send('EVENT_RECEIVED');
    } else {
    // Return a '404 Not Found' if event is not from a page subscription
      res.sendStatus(404);
    }
  } catch (err) {
    // console.log('12345', err);
  }
});

// Handles messages events
function handleMessage(pageId, received_message) {
  return new Promise((resolve, reject) => {
    const payload = received_message.text;
    // console.log('payload', payload);
    // Check if the message contains text
    if (received_message.text) {
      const query = `select * from sendMessage where pageId = '${pageId}' and payload = '${payload}'`;
      db.query(query, (error, result) => {
        if (error) {
          return reject(error);
        }
        if (result.length !== 0) {
          const response = result.map(e => JSON.parse(e.info));
          // console.log('response', response)
          return resolve(response);
        }
        // console.log('loop 1');
        // 看到不懂的文字,強制回去 getStart
        const queryGetStarted = `select * from sendMessage where pageId = '${pageId}' and payload = 'getStarted'`;
        db.query(queryGetStarted, (error, result) => {
          if (error) {
            // console.log('error', error);
            return reject(error);
          }
          const response = result.map(e => JSON.parse(e.info));
          // console.log('response', response);
          return resolve(response);
        });
        // return resolve ([{ "text": "看不懂你在幹嘛啊~~~"}])
      });
    }
  });
}

function handlePostback(pageId, received_postback) {
  return new Promise((resolve, reject) => {
    // Get the payload for the postback
    const { payload } = received_postback;
    // console.log('payload',payload)
    // 從資料找到對應到 payload 的資料
    const query = `select * from sendMessage where pageId = '${pageId}' and payload = '${payload}'`;
    // Set the response based on the postback payload
    db.query(query, (error, result) => {
      if (error) {
        return reject(error);
      }
      if (result.length !== 0) {
        const response = result.map(e => JSON.parse(e.info));
        // console.log('response', response)
        return resolve(response);
      }

      // 看到不懂的文字,強制回去 getStart
      const queryGetStarted = `select * from sendMessage where pageId = '${pageId}' and payload = 'getStarted'`;
      db.query(queryGetStarted, (error, result) => {
        if (error) {
          return reject(error);
        }
        const response = result.map(e => JSON.parse(e.info));
        return resolve(response);
      });
      // return resolve ([{ "text": "看不懂你在幹嘛啊~~~"}])
    });
  });
}

// Sends response messages via the Send API
function callSendAPI(sender_psid, response, accessToken) {
  response.forEach((arr) => {
    // Construct the message body
    const request_body = {
      recipient: {
        id: sender_psid,
      },
      message: arr,
    };
    // console.log('999', request_body);
    // 回傳訊息給 page
    axios({
      method: 'post',
      url: 'https://graph.facebook.com/v3.2/me/messages',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data: request_body,
    }).then(() => console.log('res: ', 'ok'))
      .catch(err => console.log('err: ', err));
  });
}

app.listen('3001', () => {
  console.log('Server connected on port 3001');
});
