# Facebook ChatBot 

## 設計目的
>讓使用者可以在幾分鐘生成屬於自己的聊天機器人

目前支援功能如下 : 
1.  Greeting Message
2. Wellcome Message
3. 支援擴充文字與按鍵模板
4. 支援推播功能

## 使用者說明

* 至少要申請一個 Facebook 粉絲專頁, 才可使用機器人
  >(粉絲頁申請連結 : https://www.facebook.com/pages/creation/)
## 流程詳述
1. 準備有 Facebook 粉絲頁的帳戶登入主畫面
2. 授權 Facebook 粉絲頁權限
3. 進入 User Profile , 選擇粉絲頁
4. 細部設定

    a. 設定 Wellcome Screen 

>當使用者第一進入聊天頁面會看到的訊息

<img width="500" alt="demo-greeting-messageSetting" src="https://user-images.githubusercontent.com/45849512/58164399-572e7580-7cb8-11e9-9bba-43c70eae11e1.png">
<img width="500" height="400" alt="demo-greeting-messageFB" src="https://user-images.githubusercontent.com/45849512/58164398-5695df00-7cb8-11e9-9f3e-2e02f41f114e.png">

  b.設定 Wellcome Message
 
使用者按開始使用, 就會看到顯示訊息

選項名稱:
> Button Name : 使用者看到按鈕名稱
> PostBack Name : 使用者按下對應按鈕後, Facebook server 會傳遞對應訊息給 bot's server

<img width="500" alt="demo-wellcomeMessageSetting" src="https://user-images.githubusercontent.com/45849512/58164394-54cc1b80-7cb8-11e9-9883-b46432f70eea.png">
<img width="500" height="400" alt="demo-wellcomeMessageFB" src="https://user-images.githubusercontent.com/45849512/58164397-55fd4880-7cb8-11e9-96fa-c68713265ce9.png">

  c. 設定 MoreSetting - 擴充範本訊息, 充分使用打造完整的回覆功能
<img width="500" alt="demo-moreInformationSetting" src="https://user-images.githubusercontent.com/45849512/58164401-572e7580-7cb8-11e9-8892-76ed569ceaa8.png">
<img width="500" height="400" alt="demo-moreInformationFB" src="https://user-images.githubusercontent.com/45849512/58164402-57c70c00-7cb8-11e9-85f9-d70b7a910e90.png">

5. 進階設定


    1. Broadcast (推播功能) : 利用 Cron job 做定時推播

    - 可以設定排程時間
    -  時區可以選擇 User's timezone (使用者時區, 考量使用者可能是不同來自時區, 別且需求要用當地時間推播), 時區也可以用 bot's timezone (統一用 UTC +00:00 時間推送)
    - 排程時間若無勾選, 則會推播一次; 若勾選, 則可選擇每週特定時間重複推播
<img width="500" alt="demo-broadcast-Setting" src="https://user-images.githubusercontent.com/45849512/58166737-0e2cf000-7cbd-11e9-865c-5407c1742d10.png">


    2. People (人員資訊收集) : 收集使用者 Name (姓名), Locale (地區), Gender (性別), LastSeen (最後聊天時間), SignedUp (第一次聊天時間)
<img width="500" alt="demo-people" src="https://user-images.githubusercontent.com/45849512/58166739-0e2cf000-7cbd-11e9-884a-3c5e2efa8f3b.png">


## API Doc 

### Host Name

muluisacat.com

### API Version

1.0

### SignIn API

* **End Point:** `/api/signin`

* **Method:** `GET`

* **Request Example:**

  `https://[HOST_NAME]/api/signin`

* **Request Headers:**

| Field | Type | Description |
| :---: | :---: | :---: |
| Authorization | String | Bearer AccessToken (Facebook 登入後取得的 short-lived token) |

* **Success Response: 200**

| Field | Type | Description |
| :---: | :---: | :--- |
| data | Object | Object of `User Object`. |
| accessToken | cookie | Authorization aceessToken |


`User Object`
```
{
   "data":
   { "id": 2379409302023183,
     "name": "Andrew Huang",
     "email": "test@hotmail.com",
     "accessToken": "EAAgyIpwZAexoBAJZBq43gLflpJ4GLXOrbMoBwoKHGdPGxjpdvfH4fY2JsACwwMDQQRTdG8oflfmvoe20rFkfodfmv01Dmfod40EfmvodoNuv8ZCO8F9rcIZAwZDZD",
     "expiredTime": 1561127457313 }
}
```

---

* **End Point:** `/api/[API_VERSION]/profile`

* **Method:** `GET`

* **Request Example:**

  `https://[HOST_NAME]/api/[API_VERSION]/profile`

* **Request Headers:**

| Field | Type | Description |
| :---: | :---: | :---: |
| Access Token | String | Bearer Access Token (Facebook 登入後取得的 long-lived token) |


* **Success Response: 200**

| Field | Type | Description |
| :---: | :---: | :--- |
| data | Object | Object of `Profile Object`. |
| accessToken | cookie | Authorization aceessToken |

`Profile Object`
```
{
  "data":
  [{
    name: 'Page's name',
    id: 'Page Id',
  },
  {
    name: 'Page's name2',
    id: 'Page Id 2',
  },
  ],
}
```

---

## Database Schema

<img width="1024" alt="chatbotSchema" src="https://user-images.githubusercontent.com/45849512/58397531-06d26180-8084-11e9-9997-3c54a94b691e.png">

---