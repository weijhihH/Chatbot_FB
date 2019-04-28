let accessToken = app.getCookie('Authorization');


app.init = function (){
  let id = app.getParameter("id");
  if(!id){
    window.location="./";
  }
  app.fb.pageId = id;
}

$(document).ready(callback);

function callback(){
  app.init();
  $(function(){
    // 處理 Wellcome sreen button 
    // 呼叫 api and render to html;
    $('.navWellcomeMessageGreeting').on('click',function(){
      fetch('/api/'+app.cst.apiVersion+'/webhook/greeting/getInformation?pageId='+app.fb.pageId,{
        method:'GET',
        headers:{
          'Authorization': 'Bearer '+ accessToken,
        }
      })
      .then(res => res.json())
      .then((res) => {
        // 將現有資料清掉, 避免重複按的時候出錯
        delForm();
        // Server's data render to html
        let text;
        let response = res.data
        console.log(res.data);
        if(response === 'NoData'){
          text = '請輸入問候語'
          $('#mainContent').append(wellcomeScreenContent(text));
        } else {
          // 有現成資料, 將資料 render 進去表格, 並且讓表格 disabled
          $('#mainContent').append(wellcomeScreenContent(response));
        }
      })
      .then((res) => {
        $('#wellcomeMessageFormGreeting').show();
        $('#wellcomeMessageForm').hide();
      })
      .catch((err) => {
        console.log('err')
      })
    });


    // wellcome message button 處理
    // 呼叫 api and render to html;

    $('.navWellcomeMessage').on('click',function(){
      fetch('/api/'+app.cst.apiVersion+'/webhook/wellcomeMessage/getInformation?pageId='+app.fb.pageId+'&payload=getStarted',{
        method:'GET',
        headers:{
          'Authorization': 'Bearer '+ accessToken,
        }
      }).then(res => res.json())
      .then((res) => {
        // 移除 wellcome Screen 的內容
        delForm();

        
        // 如果資料庫沒有存任何 template
        if(res.data === 'NoData'){
          $('#mainContent').append(wellcomeMessageContent(res.data));
          $('.form-control').prop('readonly', false);
        } else {
        // 資料庫已經有 template 資料, 取出來必且 render to html
          let info = JSON.parse(res.data.info)
          console.log(info);
          if(info.attachment.payload.template_type === 'button'){
            app.buttonTemplate.numberOfSet = info.attachment.payload.buttons.length
            $('#mainContent').append(wellcomeMessageContent(info));

            $('div.form-row').each(function(){
              $('.addButtonTemplate').prop('disabled', true);
              $('.deleteButtonTemplate').prop('disabled', true);
              $('.payload-type').prop('disabled',true);
            })
          }
        }
      })
      .then(() => {
        $('#wellcomeMessageFormGreeting').hide(); 
        $('#wellcomeMessageForm').show();
      })
      .catch((err) => {
        console.log('err',err);
      })
    });

    // render the data to html after click the "更多設定" button.
    $('.navMoreSetting').on('click', function () {
      delForm();
      $('#mainContent').append(addSets());
      console.log('.navMoreSetting')
      fetch(`/api/${app.cst.apiVersion}/webhook/moreSetting/getInformation?pageId=${app.fb.pageId}`,{
        method:'GET',
        headers:{
          'Authorization': 'Bearer '+ accessToken,
        }
      })
      .then(res => res.json())
      .then(res => {
        console.log('response',res.data)
        // data not found in db 
        if (res.data === 'NoData'){
          console.log('data not found in db.')
        } else{
          // 資料庫有資料, 判斷資料型態 (attachment or message)
          res.data.forEach(e => {
            console.log('element', e);
            if(e.event === 'attachment'){
              console.log('attachment')
              const payload = e.payload
              const info = JSON.parse(e.info)
              $('#mainContent').append(wellcomeMessageContent(info,true,payload))
            } else if (e.event === 'message'){
              $('#mainContent').append(textResponse(e,true))
            }
          });
          // 資料庫有資料的話, 先將按鈕都失效, 只留編輯表單按鈕可以選
          $('.btn').prop('disabled', true)
          $('.form-control').prop('readonly', true)
          $('.custom-select').prop('disabled', true);
          $('#editFormButton').prop('disabled', false);
        }
      })
      .catch(err => {
        console.log('err',err)
      })
    })
    
    // 控制 Wellcome Message 內的 Add and Delete Button
    $('#mainContent').on("click","#addButtonTemplate", function () {
      if(app.buttonTemplate.numberOfSet < 3) {
        app.buttonTemplate.numberOfSet += 1
        console.log('app.buttonTemplate.numberOfSet',app.buttonTemplate.numberOfSet)
        let html = `<div class="form-row ">`
        html += `<div class="col-3"><input type="text" class="form-control text" placeholder="Button Name"></div>`
        html += `<div class="col-3"><input type="text" class="form-control payload" placeholder="PostBack Name"></div>`

        html += `<div class="col-1.5">`
        html += `<select class="payload-type custom-select mr-sm-2" id="inlineFormCustomSelect" >`
        html += `<option selected>按鈕類型</option>`
        html += `<option value="postback">回傳按鈕</option>`
        html += `<option value="web_url">url</option>`
        html += `</select></div>`

        html += `<div class="col-1.5"><button type="button" id="addButtonTemplate" class="addButtonTemplate btn btn-primary btn-sm ">Add</button></div>`
        html += `<div class="col-1"><button type="button" id="deleteButtonTemplate" class="btn-danger deleteButtonTemplate btn btn-primary btn-sm ">Delete</button></div>`
        html += `</div>`
        $(this).closest('.form-row').after(html);
      }
    })

    $('#mainContent').on("click","#deleteButtonTemplate", function (event) {
      if(app.buttonTemplate.numberOfSet > 1) {
        app.buttonTemplate.numberOfSet -= 1
        console.log('app.buttonTemplate.numberOfSet',app.buttonTemplate.numberOfSet)
        $(this).closest('.form-row').remove(); 
      }
    })

    // DOM event for Greeting message edit button;
    $('#mainContent').on("click", "#wellcomeScreenEditButton", function () {
      const html = `<button type="submit" id="wellcomeScreenSubmitButton" class="btn btn-primary mb-2">Submit</button>`
      if(app.greetingMessage.SubmitButtonStatus === null){
        $('#wellcomeScreenTextArea').prop('readonly', false);
        $('#wellcomeScreenEditButton').after(html);
        $('#wellcomeScreenEditButton').prop('disabled', true);
        app.greetingMessage.SubmitButtonStatus = true
      } else if (app.greetingMessage.SubmitButtonStatus === true) {
        $('#wellcomeScreenTextArea').prop('readonly', false);
        $('#wellcomeScreenEditButton').prop('disabled', true);
        $('#wellcomeScreenSubmitButton').prop('disabled', false);
      }
    })

        // DOM event for Greeting message edit button;
        $('#mainContent').on("click", "#editFormButton", function () {
          console.log('12321')
          if(app.moreSetting.SubmitButtonStatus === null || app.moreSetting.SubmitButtonStatus === true){
            $('.btn').prop('disabled', false) // 解除按鈕鎖定
            $('.form-control').prop('readonly', false);
            $('.custom-select').prop('disabled', false);
            $('#editFormButton').prop('disabled', true);
            $('#submitFormButton').prop('disabled', false);
            app.moreSetting.SubmitButtonStatus = true
          }
        })



    // DOM event for wellcome screen's submit button;
    $('#mainContent').on("click", "#wellcomeScreenSubmitButton", function (event) {
      const textArea = $('#wellcomeScreenTextArea').val();
      $('#wellcomeScreenSubmitButton').prop('disabled', true);
      event.preventDefault();
      fetch('/api/'+app.cst.apiVersion+'/webhook/greeting',{
        method:'POST',
        headers:{
          'Authorization': 'Bearer '+ accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          "data":
          { "text": textArea,
            "pageId": app.fb.pageId
          }
        })
      })
      .then(res => res.json())
      .then((res) =>{ 
        $('#wellcomeScreenTextArea').prop('readonly', true);
        $('#wellcomeScreenEditButton').prop('disabled', false);
        alert('儲存成功........')
        console.log('fetch result:', res)
      })
      .catch((err) => { 
        alert('儲存失敗........')
        console.log('fetch error: ', err)
      })
    })

    // 控制 Wellcome Message 內的 Edit Button
    $('#mainContent').on("click", "#wellcomeMessageEditButton", function () {
      const html = `<button type="submit" id="wellcomeMessageSubmitButton" class="btn btn-primary mb-2">Submit</button>`
      if(app.buttonTemplate.SubmitButtonStatus === null){
        $('.form-control').prop('readonly', false);
        $('#wellcomeMessageEditButton').after(html);
        $('#wellcomeMessageEditButton').prop('disabled', true);

        $('div.form-row').each(function(){
          $('.addButtonTemplate').prop('disabled', false);
          $('.deleteButtonTemplate').prop('disabled', false);
          $('.payload-type').prop('disabled',false);
        })
        app.buttonTemplate.SubmitButtonStatus = true
      } else if (app.buttonTemplate.SubmitButtonStatus === true){
        $('.form-control').prop('readonly', false);
        $('#wellcomeMessageSubmitButton').remove();
        $('#wellcomeMessageEditButton').after(html);
        $('#wellcomeMessageEditButton').prop('disabled', true);
        $('div.form-row').each(function(){
          $('.addButtonTemplate').prop('disabled', false);
          $('.deleteButtonTemplate').prop('disabled', false);
          $('.payload-type').prop('disabled',false);
        })      
      }
    })

    // wellcome message 處理
    $('#mainContent').on("click",'#wellcomeMessageSubmitButton',function(){
      const textArr = [];
      const payloadArr = [];
      const payloadType = [];
      // 
      // 處理 ajax input datas
      // 
      $('.payload-type').each(function(i){
        payloadType.push($(this).find(":selected").val())
      })
      $('input.form-control.text').each(function(i){
        textArr.push($(this).val())
      })
      $('input.form-control.payload').each(function(i){
        payloadArr.push($(this).val())
      })
      event.preventDefault();
      const buttons = [];
      const position = 0;
      const source = "wellcomeMessage";
      const pageId = app.fb.pageId;
      const handleType = "postback";
      const eventType = $(this).parent().attr('eventtype');
      const payload = "getStarted";

      for (let i =0; i< textArr.length ; i++){
        const obj = {};        
        obj.type = payloadType[i];
        obj.title = textArr[i];
        if(obj.type === 'web_url'){
          obj.url = payloadArr[i];
        } else if (obj.type === 'postback'){
          obj.payload = payloadArr[i]
        }
        buttons.push(obj);
      }
      console.log('1923i102i30', buttons)
      const text = $('.text').val()
      // 
      // End 處理 ajax input datas
      // 
      
      fetch('/api/'+app.cst.apiVersion+'/webhook/wellcomeMessage',{
        method:'POST',
        headers:{
          'Authorization': 'Bearer '+ accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          "data":
          {
            "message_type": "button",
            "text": text,
            "buttons": buttons,
          },
            "position": position,
            "pageId": pageId,
            "source": source,
            "handleType": handleType,
            "event": eventType,
            "payload": payload
        })
      })
      .then(res => res.json())
      .then((res) => {
        $('.form-control').prop('readonly', true);
        $('#wellcomeMessageEditButton').prop('disabled', false);
        $('#wellcomeMessageSubmitButton').prop('disabled', true);
        $('div.form-row').each(function(){
          $('.addButtonTemplate').prop('disabled', true);
          $('.deleteButtonTemplate').prop('disabled', true);
          $('.payload-type').prop('disabled',true);
        })

        alert('儲存成功..........')
        console.log('fetch result:', res)
      })
      .catch((err) => {
        alert('儲存失敗..........')
        console.log('fetch error: ', err)
      }) // end of fetch
    }) // end of wellcomeMessageForm 處理

    // 按下增加按鈕 (新增組數)
    $('#mainContent').on('click','#addNewSetButton', function () {
      const buttonType = $('#addNewSetSelector').val()
      console.log('buttonType',buttonType)
      if(buttonType === 'textResponse'){
        console.log('textResponse')
        $('#mainContent').append(textResponse());
      } else if (buttonType === 'buttonTemplate'){
        console.log('buttonTemplate')
        $('#mainContent').append(wellcomeMessageContent('NoData', true));
        $('.form-control').prop('readonly', false);

      } else {
        alert('請選擇一種類型')
      }
      
    })

    // 操作 Up botton
    $('#mainContent').on('click','.upButton', function () {
      // 當前操作的父層編號
      const parentDiv = $(this).closest('.moreSettingDiv')
      // 找出所有父層, 並且看 button 位置是第幾個
      const divIndex = $(this).parents('.moreSettingDiv').index()
      if(divIndex > 0){
        // 交換位置
        parentDiv.prev().insertAfter(parentDiv)  
      }
    })

    // 操作 Down botton
    $('#mainContent').on('click','.downButton', function () {
      // 當前操作的父層編號
      const parentDiv = $(this).closest('.moreSettingDiv')
      // 找出所有父層, 並且看 button 位置是第幾個
      const divIndex = $(this).parents('.moreSettingDiv').index()
      // 符合條件的 div 有幾個
      const divLength = $('.moreSettingDiv').length;

      // 判斷邏輯, div 位置 跟 div數量判斷
      if(divIndex < divLength-1 ){
        // 交換位置
        parentDiv.next().insertBefore(parentDiv) 
      }
    })

    // 操作 delete dutton - more setting 
    $('#mainContent').on('click','.deleteButton', function () {
      console.log('123')
      $(this).closest('.moreSettingDiv').remove();
      let a = $(this).parent().index('.moreSettingDiv')
      console.log('1234444',a)
    })

    // 操作 submit button - more setting 
    // 將資料送到後台
    $('#mainContent').on('click','button#submitFormButton', function () {
      event.preventDefault();
      // data , 整理輸入資料
      let data = [];
      // 1. 判斷輸入資料比數
      $('.moreSettingDiv').each(function(index){
        // event : message or attachment
        let event = $(this).attr('eventType')
        // handleType = message or postback (定義是針對 message or postback event 回覆)
        let handleType = $('input.form-control.payload').attr('handleType')
        // console.log('index', index)
        console.log('event', event);
        // 考慮不同情況整理資料
        // 當輸入訊息是 message 的時候 ; 非 postback event , 且是一般訊息回覆
        let payload = $(this).find('.payload').val()
        let text = $(this).find('.text').val()
        let source = "moreSetting"
        let pageId = app.fb.pageId
        if( event === 'message'){
          // console.log('payload', payload)
          // console.log('text', text)
          data.push({
            "source": source,
            "pageId": pageId,
            "position": index,
            "event": event, // event : message or attachment
            "payload": payload,
            "handleType": handleType,
            "message": {
                "text": text
              }
          })
        } else if(event === 'attachment') {
          console.log(`blockType === 'buttonTemplate'`)
          // 處理 button template 中的 button 資料
          const textArr = [];
          const payloadArr = [];
          const payloadType = [];
          $('.payload-type').each(function(i){
            payloadType.push($(this).find(":selected").val())
          })
          $('input.form-control.text').each(function(i){
            textArr.push($(this).val())
          })
          $('input.form-control.payload').each(function(i){
            payloadArr.push($(this).val())
          })
          const buttons = [];
          for (let i =0; i< textArr.length ; i++){
            const obj = {};        
            obj.type = payloadType[i];
            obj.title = textArr[i];
            if(obj.type === 'web_url'){
              obj.url = payloadArr[i];
            } else if (obj.type === 'postback'){
              obj.payload = payloadArr[i]
            }
            buttons.push(obj);
          }
        
          data.push({
            "source": source,
            "pageId": pageId,
            "position": index,
            "event": event, // event : message or attachment
            "payload": payload,
            "handleType": handleType,
            "message":
              {
                "template_type": "button",
                "text": text,
                "buttons": buttons,
              }
          })
        }



      })
      console.log('data output', data);
      
      // 2. 整理輸入資料格式
      fetch('/api/'+app.cst.apiVersion+'/webhook/moreSetting',{
        method:'POST',
        headers:{
          'Authorization': 'Bearer '+ accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          "data": data
        })
      })
      .then((res) => {
        console.log('ok',res);
        // 成功, 將送出表單按鈕隱藏起來
        $('#submitFormButton').prop('disabled', true);
        $('.btn').prop('disabled', true);
        $('.form-control').prop('readonly', true);
        $('.custom-select').prop('disabled', true);
        $('#editFormButton').prop('disabled', false);

      })    
      .catch((err) => {
        console.log('error', err);
        alert('資料存入失敗')
      })
    })

  })
}




// wellcome screen content
function wellcomeScreenContent(text){
  let html = `<form id="wellcomeMessageFormGreeting " class=" form-group delForm" divId="new">`
  html += `<label for="wellcomeMessageTextArea">Wellcome message - Greeting - 使用者第一次要開始聊天的時候會顯示的訊息</label>`
  if( text === 'NoData'){
    html += `<textarea class="form-control" id="wellcomeScreenTextArea" rows="10" placeholder="${text}" ></textarea>`
  } else {
    html += `<textarea class="form-control" id="wellcomeScreenTextArea" rows="10" readonly>${text}</textarea>`
  }
  html += `<button type="button" id="wellcomeScreenEditButton" class="btn btn-primary mb-2">Edit</button>`
  html += `</form>`
  return html
}


// wellcome message content 
// 下面邏輯考慮是否要從資料庫 render 資料進去
// 1. if info = "NoData" , 表示資料庫沒有資料
// 2. else , 表示資料庫有現成資料
function wellcomeMessageContent(info,addNewSet = false,payload = false){
  let html = `<form id="wellcomeMessageForm " class=" form-group delForm moreSettingDiv" eventType="attachment" divId="new">`
  if(addNewSet){
    html += `<button type="button" class="btn btn-sm btn-danger deleteButton">Delete</button>`
    html += `<button type="button" class="btn btn-sm btn-success upButton">Up</button>`
    html += `<button type="button" class="btn btn-sm btn-success downButton">Down</button>`
  }
  html += `<label>Button Template (下列 Button 選項需為 1~3 組)</label>`
  if(addNewSet && payload){
    html += `<input type="text" class="form-control payload" handleType="postback" placeholder="message event" rows="1" value="${payload}" readonly>`
  } else if (addNewSet && !payload){
    html += `<input type="text" class="form-control payload" handleType="postback" placeholder="message event" rows="1" readonly>`
  }
  html += `<textarea class="form-control text" placeholder="Text" rows="1" readonly>`
  if(info !== 'NoData'){
    html += `${info.attachment.payload.text}`
  }
  html += `</textarea>`
  
  // 判斷 button 組數, 並且 render 進去
  for (let i=0; i< app.buttonTemplate.numberOfSet; i++){
    html += `<div class="form-row">`
    html += `<div class="col-3"><input type="text" class="form-control text" placeholder="Button Name" `
    if(info !== 'NoData'){
      html += `value="${info.attachment.payload.buttons[i].title}"`
    }
    html += `readonly ></div>`
    
    if(info === 'NoData'){
      html += `<div class="col-3"><input type="text" class="form-control payload" placeholder="PostBack Name" readonly ></div>`
    } else if (info !== 'NoData' && info.attachment.payload.buttons[i].type === "postback"){
      // button 為 postback 類型
      html += `<div class="col-3"><input type="text" class="form-control payload" placeholder="PostBack Name"`
      html += `value="${info.attachment.payload.buttons[i].payload}" readonly ></div>`
    } else if (info !== 'NoData' && info.attachment.payload.buttons[i].type === "web_url"){
      // button 為 payload 類型
      html += `<div class="col-3"><input type="text" class="form-control payload" placeholder="PostBack Name" `
      html += `value="${info.attachment.payload.buttons[i].url}" readonly ></div>`
    }

    html += `<div class="col-1.5">`
    html += `<select class="payload-type custom-select mr-sm-2" id="inlineFormCustomSelect" >`
    // render to selected button
    html += `<option selected>按鈕類型</option>`

    if(info === 'NoData') {
      html += `<option value="postback">回傳按鈕</option>`
      html += `<option value="web_url">url</option>`
    } else if(info.attachment.payload.buttons[i].type === "postback"){
      html += `<option value="postback" selected="selected">回傳按鈕</option>`
      html += `<option value="web_url">url</option>`
    } else if (info.attachment.payload.buttons[i].type === "web_url"){
      html += `<option value="postback">回傳按鈕</option>`
      html += `<option value="web_url" selected="selected">url</option>`
    }

    html += `</select></div>`
    html += `<div class="col-1.5"><button type="button" id="addButtonTemplate" class="addButtonTemplate btn btn-primary btn-sm ">Add</button></div>`
    html += `<div class="col-1"><button type="button" id="deleteButtonTemplate" class="btn-danger deleteButtonTemplate btn btn-primary btn-sm ">Delete</button></div>`
    html += `</div>`
  }
  if(info === 'NoData' && addNewSet === false){
    html += `<button type="submit" id="wellcomeMessageSubmitButton" class="btn btn-primary mb-2">Submit</button>`
  } else if (info !== 'NoData' && addNewSet === false){
    html += `<button type="submit" id="wellcomeMessageEditButton" class="btn btn-primary mb-2 ">Edit</button>`
  }
  html += `</form>`
  return html
}

function addSets(){
  let html = `
    <form class="addNewSet delForm" >
    <button type="button" class="btn btn-primary" id="editFormButton" disabled >編輯表單</button>
    <button type="submit" class="btn btn-primary" id="submitFormButton">送出表單</button>
      <div class="form-row align-items-center">
        <label class="col-auto mr-sm-2" for="inlineFormCustomSelect">Button Type</label>
        <div class="col-auto my-1">
          <select class="custom-select mr-sm-2" id="addNewSetSelector">
            <option selected>Button Type...</option>
            <option value="textResponse">回傳文字範本</option>
            <option value="buttonTemplate">回傳按鈕範本</option>
          </select>
        </div>
        <div class="col-auto my-1">
            <button type="button" class="btn btn-primary" id="addNewSetButton">增加</button>
        </div>
      </div>
    </form>`
  return html;
}

// 文字範本
function textResponse (content,addNewSet = false){
  let html;
  // 在 lib.js naming #index
  html = `<form class="moreSettingDiv delForm" eventType="message" divId="new">`
  html += `<div class="form-group">`
  html += `<button type="button" class="btn btn-sm btn-danger deleteButton">Delete</button>`
  html += `<button type="button" class="btn btn-sm btn-success upButton">Up</button>`
  html += `<button type="button" class="btn btn-sm btn-success downButton">Down</button>`
  html += `<label for="textResponse">Text Response</label>`
  if(addNewSet){
    const messageEvent = content.payload
    html += `<input type="text" class="form-control payload" handleType="message" placeholder="message event" value="${messageEvent}">`
  } else {
    html += `<input type="text" class="form-control payload" handleType="message" placeholder="message event">`
  }
  html += `<small class="form-text text-muted"></small>`
  if(addNewSet){
    const message = JSON.parse(content.info).text
    html += `<input type="text" class="form-control text" placeholder="輸入傳出去的文字" value="${message}">`
  } else {
    html += `<input type="text" class="form-control text" placeholder="輸入傳出去的文字">`
  }
  html += `<small class="form-text text-muted"></small>`
  // html += `<button type="button" class="btn btn-primary EditButton">Edit</button>`
  // html += `<button type="button" class="btn btn-primary SubmitButton">Submit</button>`
  html += `</div>`
  html += `</form>`
  return html;
}



// 用來控制刪掉其他表單,再切換不同頁面的時候 
function delForm (){
  $('.delForm').each(function(){
    $(this).remove();
  })
}