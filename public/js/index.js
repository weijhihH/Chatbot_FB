// FB 預載入判斷有無登入
window.addEventListener('DOMContentLoaded', app.fb.load);
window.fbAsyncInit = app.fb.init;

// FB 登入按鍵
function fbLogin () {
  FB.login((response) => {
    if (response.status === 'connected') {
      // console.log('FB.login successed: ', response.authResponse.accessToken)
      // use FB token to connect backend server.
      fetch('/api/signin', {
        headers: {
          Authorization: `Bearer ${response.authResponse.accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        method: 'GET',
      })
        .then(res => res.json())
        .then((res) => {
          $('.facebook-button').hide();
          app.state.auth = res.data.accessToken;
          window.location = '/user/profile.html';
        })
        .catch(() => alert('登入失敗，請重新嘗試'));
    } else {
      // console.log('FB.login failed');
      alert('登入失敗，請重新嘗試');
      // The person is not logged into this app or we are unable to tell.
    }
  }, {
    scope: 'email,pages_messaging,pages_messaging_subscriptions,manage_pages,pages_show_list',
    return_scopes: true,
  });
}
