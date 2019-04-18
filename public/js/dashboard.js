let accessToken = app.getCookie('Authorization');


app.init = function (){
  let id = app.getParameter("id");
  if(!id){
    window.location="./";
  }
  app.fb.pageId = id;
}

function callback(){
  app.init();
  $(function(){
    $('.navWellcomeMessage').on('click',function(){
      console.log('123')
      $('#wellcomeMessageForm').show();
    });

    $('#wellcomeMessageForm').submit(function(event){
      const textArea = $('#wellcomeMessageTextArea').val();
      $('#wellcomeMessageButton').attr('disabled', true);
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
        console.log('fetch result:', res)
      })
      .catch((err) => { 
        console.log('fetch error: ', err)
      })
    })
  })


}

$(document).ready(callback);




