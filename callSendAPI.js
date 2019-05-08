const axios = require('axios');
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
exports.callSendAPI = callSendAPI;
