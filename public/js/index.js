// FB 預載入判斷有無登入
window.addEventListener("DOMContentLoaded", app.fb.load);
window.fbAsyncInit=app.fb.init;

// FB 登入按鍵
function fbLogin (){
  FB.login(function(response) {
    if (response.status === 'connected') {
      console.log('FB.login successed: ', response.authResponse.accessToken)
      fetch('/api/'+app.cst.apiVersion+'/signin',{
        headers:{
          'Authorization': 'Bearer '+ response.authResponse.accessToken,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        method: 'GET'
      })
      .then(res => res.json() )
      .then((res) => {
        // 隱藏原本按鈕&跳頁
        $('.facebook-button').hide()
        app.state.auth = res.data.accessToken
        window.location = '/user/profile.html'
      })
      .catch( error => console.error('fetch failed', error))
      // Logged into your app and Facebook.
    } else {
      console.log('FB.login failed')
      // The person is not logged into this app or we are unable to tell. 
    }
  },{
    scope: 'email,pages_messaging,pages_messaging_subscriptions,manage_pages,pages_show_list',
    return_scopes: true
  });
}

