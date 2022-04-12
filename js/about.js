const hub = document.querySelector(".hubs");
const hub_text = hub.textContent;
const hub_text_split = hub_text.split(" ");                           // identify each word, separated by a space

hub.textContent = "";                                                  // delete the text
for(let i=0; i < hub_text_split.length; i++){
    if (hub_text_split[i] == 'man' || hub_text_split[i] == 'uilding' || hub_text_split[i] == 'ynergy' || hub_text_split[i] == 'Laboratory'){
        hub.innerHTML += "<span class='text-oasis text-shadow-white'>" + hub_text_split[i] + " </span>"
    } else {
        hub.innerHTML += "<span class='text-azurite text-shadow-white'>" + hub_text_split[i] + "</span>"
    }
}

let char = 0;
let delay = 650
let timer = setInterval(onTick, delay);

function onTick(){
    const span = hub.querySelectorAll('span')[char];
    if (span.textContent == 'man ' || span.textContent == 'uilding ' || span.textContent == 'ynergy ' || span.textContent == 'Laboratory '){
        span.classList.add('fade');
        setTimeout(function(){
            span.textContent = "";
        }, delay);
    }
    char++
    if(char == hub_text_split.length){
        complete();
        return;
    }
}

function complete(){
    clearInterval(timer);
    timer = null;
}