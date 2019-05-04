/* eslint-disable no-undef */
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


    // click Message
    $('.messageList').on('click', function () {
      switchList('message')
    })

    // click Broadcast 
    $('.broadcastList').on('click', function () {
      switchList('broadcast')
    })

    // click people button
    $('.peopleList').on('click', function () {
      switchList('people')
      // 跟後台要資料, db - people 
      fetch('/api/'+app.cst.apiVersion+'/webhook/people/getInformation?pageId='+app.fb.pageId,{
        method:'GET',
        headers:{
          'Authorization': 'Bearer '+ accessToken,
        }
      })
      .then(res => res.json())
      .then((res) => {
        // 將資料 render to table
        // console.log('res data', res.data)
        $('#peopleTable').append(addNewPeopleRow(res.data));
      })
    })

    function switchList(content){
      delForm();
      if(content === 'message'){
        $('#broadCast').hide();
        $('#message').show();
        $('#mainContentBroadcast').hide();
        $('#mainContent').show();
      } else if (content === 'broadcast'){
        $('#broadCast').show();
        $('#message').hide();
        $('#mainContentBroadcast').show();
        $('#mainContent').hide();
      } else if (content === 'people'){
        $('#broadCast').hide();
        $('#message').hide();
        $('#mainContentBroadcast').hide();
        $('#mainContent').hide();
      }
    }


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
        // console.log(res.data);
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
        // console.log('err')
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
      })
      .then(res => res.json())
      .then((res) => {
        // 移除 wellcome Screen 的內容
        delForm();

        
        // 如果資料庫沒有存任何 template
        if(res.data === 'NoData'){
          app.buttonTemplate.numberOfSet = 1;
          $('#mainContent').append(wellcomeMessageContent(res.data));
          $('.form-control').prop('readonly', false);
        } else {
        // 資料庫已經有 template 資料, 取出來必且 render to html
          let info = JSON.parse(res.data.info)
          // console.log(info);
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
        // console.log('err',err);
      })
    });

    // 按下 broadcast 內的 message setting button
    $('.navBroadcastSetting').on('click', function () {
      // console.log('.navBroadcastSetting')
      delForm();
      $('#mainContentBroadcast').append(addSets());
      fetch(`/api/${app.cst.apiVersion}/webhook/broadcast/getInformation?pageId=${app.fb.pageId}`,{
        method:'GET',
        headers:{
          'Authorization': 'Bearer '+ accessToken,
        }
      })
      .then(res => res.json())
      .then(res => {
        // data was not found in db
        if (res. data === 'NoData'){
          // console.log('data not found in db.')
        }  else{
          // console.log(res.data);
          // 資料庫有資料, 判斷資料型態 (attachment or message)
          res.data.forEach(e => {
            // console.log('element', e);
            if(e.event === 'attachment'){
              // console.log('attachment')
              const payload = e.payload
              const info = JSON.parse(e.info)
              app.buttonTemplate.numberOfSet = info.attachment.payload.buttons.length
              // console.log('12313', app.buttonTemplate.numberOfSet)
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
    })

    // render the data to html after click the "更多設定" button.
    $('.navMoreSetting').on('click', function () {
      delForm();
      $('#mainContent').append(addSets());
      // console.log('.navMoreSetting')
      fetch(`/api/${app.cst.apiVersion}/webhook/moreSetting/getInformation?pageId=${app.fb.pageId}`,{
        method:'GET',
        headers:{
          'Authorization': 'Bearer '+ accessToken,
        }
      })
      .then(res => res.json())
      .then(res => {
        // console.log('response',res.data)
        // data was not found in db 
        if (res.data === 'NoData'){
          // console.log('data not found in db.')
        } else{
          // console.log(res.data);
          // 資料庫有資料, 判斷資料型態 (attachment or message)
          res.data.forEach(e => {
            // console.log('element', e);
            if(e.event === 'attachment'){
              // console.log('attachment')
              const payload = e.payload
              const info = JSON.parse(e.info)
              app.buttonTemplate.numberOfSet = info.attachment.payload.buttons.length
              // console.log('12313', app.buttonTemplate.numberOfSet)
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
        // console.log('err',err)
      })
    })

    // 
    // 控制 mainContentBroadcast 內容內的選項
    // 

    // 按下增加 button type 按鈕, 將後台資料 render to html
    $('#mainContentBroadcast').on('click','#addNewSetButton', function () {
      if(!app.broadcast.numberOfSet){
        const buttonType = $('#addNewSetSelector').val()
        if(buttonType === 'textResponse'){
          $('#mainContentBroadcast').append(textResponse());
          $('#mainContentBroadcast').append(addDateTimePicker());
          $('#mainContentBroadcast').append(addRepeatSlector());
          app.broadcast.numberOfSet += 1;
        } else if (buttonType === 'buttonTemplate'){
          app.broadcast.numberOfSet += 1;
          $('#mainContentBroadcast').append(wellcomeMessageContent('NoData', true));
          $('#mainContentBroadcast').append(addDateTimePicker());
          $('#mainContentBroadcast').append(addRepeatSlector());
          $('.form-control').prop('readonly', false);

        } else {
          alert('請選擇一種類型')
        }
      } else {
        alert('組數已達上限,請先將現有設定刪除後才能新增')
      }
      $('.upButton').hide();
      $('.downButton').hide();

      // 處理日期選取
      $('#datetimepicker4').datetimepicker({
        format: 'L',
      });
      // 處理時間選取
      $('#datetimepicker3').datetimepicker({
        format: 'LT',
        stepping: 30, // 單位是半個小時
      });

    })

    // 將資料送出到後台 (broadcast setting)
    $('#mainContentBroadcast').on('click','button#submitFormButton', function () {
      event.preventDefault();
      console.log('test mainContentBroadcast')
      // 整理資料
      let data = [];
      $('.moreSettingDiv').each(function(index){
        // event : message or attachment
        let event = $(this).attr('eventType')
        // handleType = message or postback (定義是針對 message or postback event 回覆)
        let handleType = $('input.form-control.payload').attr('handleType')
        // 考慮不同情況整理資料
        // 當輸入訊息是 message 的時候 ; 非 postback event , 且是一般訊息回覆
        let payload = $(this).find('.payload').val()
        let text = $(this).find('.text').val()
        let source = "broadcast"
        let pageId = app.fb.pageId

        // 處理排程時間設定
        // 選 repeat date
        let repeatDate = [];
        $.each($("input[name='repeatDate']:checked"), function () {
          repeatDate.push($(this).val())
        })
        // 選 開始日期跟時間
        // 時間由 AMPM 轉為 24-hours
        const date = $(".dateInput")[0].value
        let time = $(".timeInput")[0].value
        let hours = Number(time.match(/^(\d+)/)[1]);
        let minutes = Number(time.match(/:(\d+)/)[1]);
        let AMPM = time.match(/\s(.*)$/)[1];
        if(AMPM == "PM" && hours<12) hours = hours+12;
        if(AMPM == "AM" && hours==12) hours = hours-12;
        let sHours = hours.toString();
        let sMinutes = minutes.toString();
        if(hours<10) sHours = "0" + sHours;
        if(minutes<10) sMinutes = "0" + sMinutes;
        const twentyFourHoursTime = sHours+ ":"+sMinutes;
        // 選 timezone
        const timezone = $("select#timezone option:selected").val()

        if( event === 'message'){
          data.push({
            "source": source,
            "pageId": pageId,
            "position": index,
            "event": event, // event : message or attachment
            "payload": payload,
            "handleType": handleType,
            "message": {
                "text": text
              },
            "repeatDate": repeatDate,
            "date": date,
            "time": twentyFourHoursTime,
            "timezone": timezone
          })
        } else if(event === 'attachment') {
          // console.log(`blockType === 'buttonTemplate'`)
          // 處理 button template 中的 button 資料
          const textArr = [];
          const payloadArr = [];
          const payloadType = [];
          
          $(this).find(":selected").each(function(){
            payloadType.push($(this).val())
          })
          $(this).find("input.form-control.button.text").each(function(){
            textArr.push($(this).val())
          })
          $(this).find("input.form-control.button.payload").each(function(){
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
              },
            "repeatDate": repeatDate,
            "date": date,
            "time": twentyFourHoursTime,
            "timezone": timezone
          })
        }
      })
      
      console.log('data output', data);
      //  2. 資料送進後台
      fetch('/api/'+app.cst.apiVersion+'/broadcast',{
        method: 'POST',
        headers:{
          'Authorization': 'Bearer '+ accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          "data": data
        })
      })
      .then(res => res.json())
      .then(res => {
        console.log('res', res)
        alert('資料存入成功')
      })
      .catch(err => {
        console.log('err', err)
        alert('資料存入失敗')
      })

    }) // end 將資料送出到後台 (broadcast setting)

    // 操作 delete button - broadcast setting
    $('#mainContentBroadcast').on('click','.deleteButton', function () {
      $('.moreSettingDiv').each(function(){
        $(this).remove();
      })
      app.broadcast.numberOfSet = null;
    })

    // add button template in broadcast setting page
    $('#mainContentBroadcast').on("click","#addButtonTemplate", function () {
      let numberOfElements = $(this).parents('.moreSettingDiv').children('.form-row').length
      if(numberOfElements < 3) {
        let html = `<div class="form-row ">`
        html += `<div class="col-3"><input type="text" class="form-control button text" placeholder="Button Name"></div>`
        html += `<div class="col-3"><input type="text" class="form-control button payload" placeholder="PostBack Name"></div>`

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
    // delete button template in broadcast setting page
    $('#mainContentBroadcast').on("click","#deleteButtonTemplate", function () {
      let numberOfElements = $(this).parents('.moreSettingDiv').children('.form-row').length
      if(numberOfElements > 1) {
        $(this).closest('.form-row').remove(); 
      }
    })

    // 控制 Wellcome Message 內的 Add and Delete Button
    $('#mainContent').on("click","#addButtonTemplate", function () {
      let numberOfElements = $(this).parents('.moreSettingDiv').children('.form-row').length
      if(numberOfElements < 3) {
        let html = `<div class="form-row ">`
        html += `<div class="col-3"><input type="text" class="form-control button text" placeholder="Button Name"></div>`
        html += `<div class="col-3"><input type="text" class="form-control button payload" placeholder="PostBack Name"></div>`

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

    $('#mainContent').on("click","#deleteButtonTemplate", function () {
      let numberOfElements = $(this).parents('.moreSettingDiv').children('.form-row').length
      if(numberOfElements > 1) {
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
          // console.log('12321')
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
      })
      .catch((err) => { 
        alert('儲存失敗........')
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
      $('.payload-type').each(function(){
        payloadType.push($(this).find(":selected").val())
      })
      $('input.form-control.text').each(function(){
        textArr.push($(this).val())
      })
      $('input.form-control.payload').each(function(){
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
      // console.log('1923i102i30', buttons)
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
        // console.log('fetch result:', res)
      })
      .catch((err) => {
        alert('儲存失敗..........')
        // console.log('fetch error: ', err)
      }) // end of fetch
    }) // end of wellcomeMessageForm 處理

    // 按下增加按鈕 (新增組數)
    $('#mainContent').on('click','#addNewSetButton', function () {
      const buttonType = $('#addNewSetSelector').val()
      // console.log('buttonType',buttonType)
      if(buttonType === 'textResponse'){
        // console.log('textResponse')
        $('#mainContent').append(textResponse());
      } else if (buttonType === 'buttonTemplate'){
        // console.log('buttonTemplate')
        app.buttonTemplate.numberOfSet = 1;
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
      // console.log('divIndex',divIndex)
      if(divIndex > 1){
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
      if(divIndex < divLength){
        // 交換位置
        parentDiv.next().insertBefore(parentDiv) 
      }
    })

    // 操作 delete dutton - more setting 
    $('#mainContent').on('click','.deleteButton', function () {
      $(this).closest('.moreSettingDiv').remove();
      // let a = $(this).parent().index('.moreSettingDiv')
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
        // 考慮不同情況整理資料
        // 當輸入訊息是 message 的時候 ; 非 postback event , 且是一般訊息回覆
        let payload = $(this).find('.payload').val()
        let text = $(this).find('.text').val()
        let source = "moreSetting"
        let pageId = app.fb.pageId
        if( event === 'message'){
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
          // console.log(`blockType === 'buttonTemplate'`)
          // 處理 button template 中的 button 資料
          const textArr = [];
          const payloadArr = [];
          const payloadType = [];
          
          $(this).find(":selected").each(function(){
            payloadType.push($(this).val())
          })
          $(this).find("input.form-control.button.text").each(function(){
            textArr.push($(this).val())
          })
          $(this).find("input.form-control.button.payload").each(function(){
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
      // console.log('data output', data);
      
      // 2. 資料送進後台
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
      .then(res => res.json())
      .then((res) => {
        // console.log('ok',res);
        // 成功, 將送出表單按鈕隱藏起來
        $('#submitFormButton').prop('disabled', true);
        $('.btn').prop('disabled', true);
        $('.form-control').prop('readonly', true);
        $('.custom-select').prop('disabled', true);
        $('#editFormButton').prop('disabled', false);

      })    
      .catch((err) => {
        // console.log('error', err);
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
    html += `<div class="col-3"><input type="text" class="form-control button text" placeholder="Button Name" `
    if(info !== 'NoData'){
      html += `value="${info.attachment.payload.buttons[i].title}"`
    }
    html += `readonly ></div>`
    
    if(info === 'NoData'){
      html += `<div class="col-3"><input type="text" class="form-control button payload" placeholder="PostBack Name" readonly ></div>`
    } else if (info !== 'NoData' && info.attachment.payload.buttons[i].type === "postback"){
      // button 為 postback 類型
      html += `<div class="col-3"><input type="text" class="form-control button payload" placeholder="PostBack Name"`
      html += `value="${info.attachment.payload.buttons[i].payload}" readonly ></div>`
    } else if (info !== 'NoData' && info.attachment.payload.buttons[i].type === "web_url"){
      // button 為 payload 類型
      html += `<div class="col-3"><input type="text" class="form-control button payload" placeholder="PostBack Name" `
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
    html += `<input type="text" class="form-control button text" placeholder="輸入傳出去的文字" value="${message}">`
  } else {
    html += `<input type="text" class="form-control button text" placeholder="輸入傳出去的文字">`
  }
  html += `<small class="form-text text-muted"></small>`
  // html += `<button type="button" class="btn btn-primary EditButton">Edit</button>`
  // html += `<button type="button" class="btn btn-primary SubmitButton">Submit</button>`
  html += `</div>`
  html += `</form>`
  return html;
}

// 處理資料庫資料 - render to html table
function addNewPeopleRow (data){
  // const paging = Math.ceil(data.length / 15);
  let lastSeenConvertToDate;
  let signedUpConvertToDate;
  let html = `<table class="table table-hover delForm">`
  html += `
    <thead>
      <tr>
        <th scope="col">PSID</th>
        <th scope="col">Name</th>
        <th scope="col">Locale</th>
        <th scope="col">gender</th>
        <th scope="col">lastSeen</th>
        <th scope="col">SignedUp</th>
      </tr>
      </thead>
    `
  data.forEach(e => {
    // console.log('e',e)
    // console.log('1',parseInt(e.lastSeen))
    // console.log('2',parseInt(e.signedUp))
    lastSeenConvertToDate = app.formatDate(parseInt(e.lastSeen))
    signedUpConvertToDate = app.formatDate(parseInt(e.signedUp))
    html +=`
      <tbody>
        <tr>
          <td>${e.PSID}</td>
          <td>${e.name}</td>
          <td>${e.locale}</td>
          <td>${e.gender}</td>
          <td>${lastSeenConvertToDate}</td>
          <td>${signedUpConvertToDate}</td>
        </tr>
      </tbody>
    `
  });
  html += `</table>`
  // 下面 paging 還沒做功能
  html += `
    <nav aria-label="Page navigation" class="delForm">
      <ul class="pagination">
        <li class="page-item"><a class="page-link" href="#">Previous</a></li>
        <li class="page-item"><a class="page-link" href="#">1</a></li>
        <li class="page-item"><a class="page-link" href="#">2</a></li>
        <li class="page-item"><a class="page-link" href="#">3</a></li>
        <li class="page-item"><a class="page-link" href="#">Next</a></li>
      </ul>
    </nav>
  `

  return html;
}

// 用來控制刪掉其他表單,再切換不同頁面的時候 
function delForm(){
  $('.delForm').each(function(){
    $(this).remove();
  })
  app.broadcast.numberOfSet=null;
}

function addDateTimePicker(){
  let html = `
  <div class="row delForm timerpickerSelector moreSettingDiv">
    <label class="col-12">排程設定</label>
    <div class="col-4 container ">
      <div class="form-group">
        <div class="input-group date" id="datetimepicker4" data-target-input="nearest">
            <input type="text" class="form-control datetimepicker-input dateInput" data-target="#datetimepicker4" name="datepicker" placeholder="日期"/>
            <div class="input-group-append" data-target="#datetimepicker4" data-toggle="datetimepicker">
              <div class="input-group-text"><i class="fa fa-calendar"></i>
              </div>
            </div>
          </div>
        </div>
    </div>
    <div class="col-4 container">
      <div class="form-group">
        <div class="input-group date" id="datetimepicker3" data-target-input="nearest">
          <input type="text" class="form-control datetimepicker-input timeInput" data-target="#datetimepicker3" name="timepicker" placeholder="時間"/>
          <div class="input-group-append" data-target="#datetimepicker3" data-toggle="datetimepicker">
            <div class="input-group-text"><i class="fa fa-clock-o" ></i>
            </div>
          </div>
        </div>
      </div>
    </div>
    <select class="col-3 custom-select mr-sm-2" id="timezone">
    <option value="userTimezone" selected>User's timezone</option>
    <option value="botTimezone">Bot's timezone (UTC+00:00)</option>
    </select>
  </div>
  `
  return html;
}

function addRepeatSlector(){
  // let html = `
  //     <div class="btn-group delForm">
  //     <select class="custom-select " id="addNewSetSelector">
  //       <option selected>Repeat: ..</option>
  //       <option value="none">Repeat: None</option>
  //       <option value="everyday">Repeat: Every Day</option>
  //       <option value="customerDefined">Repeat: Cutomer defined</option>
  //     </select>
  //     </div>
  // `
  let html = `
  <div class="repeatSelector btn-group delbutton row moreSettingDiv" data-toggle="buttons" hide>
  <label class="col-12">請勾選排程每週哪一天執行 (可複選) </label>
  <label class="btn btn-outline-primary btn-sm"><input type="checkbox" name="repeatDate" value="sunday"> Sunday</label>
  <label class="btn btn-outline-primary btn-sm"><input type="checkbox" name="repeatDate" value="monday"> Monday</label>
  <label class="btn btn-outline-primary btn-sm"><input type="checkbox" name="repeatDate" value="tuesday"> Tuesday</label>
  <label class="btn btn-outline-primary btn-sm"><input type="checkbox" name="repeatDate" value="wednesday"> Wednesday</label>
  <label class="btn btn-outline-primary btn-sm"><input type="checkbox" name="repeatDate" value="thursday"> Thursday</label>
  <label class="btn btn-outline-primary btn-sm"><input type="checkbox" name="repeatDate" value="friday"> Friday</label>
  <label class="btn btn-outline-primary btn-sm"><input type="checkbox" name="repeatDate" value="saturday"> Saturday</label>
  </div>
  `
  return html
}