const hub1 = document.querySelector(".hubs-1");
const hub1_text = hub1.textContent;
const hub1_text_split = hub1_text.split(" ");                           // identify each word, separated by a space

hub1.textContent = "";                                                  // delete the text
for(let i=0; i < hub1_text_split.length; i++){
    if (hub1_text_split[i] == 'Synergy'){
        hub1_text_split[i] += "<br>"                                    // 
    }
    hub1.innerHTML += "<span>" + hub1_text_split[i] + " </span>"
}

let char = 0;
let timer = setInterval(onTick, 350);

function onTick(){
    const span = hub1.querySelectorAll('span')[char];
    span.classList.add('fade');
    if (span.textContent == 'Synergy '){
        // span.style.color = "#"+(rgb_synergy[0]).toString(16)+(rgb_synergy[1]).toString(16)+(rgb_synergy[2]).toString(16);
        span.classList.add('synergy', 'shadow_white')
    } else if (span.textContent == 'Human '){
        span.classList.add('human')
        //span.style.color = "#"+(rgb_human[0]).toString(16)+(rgb_human[1]).toString(16)+(rgb_human[2]).toString(16);
    } else if (span.textContent == 'Building '){
        span.classList.add('building')
        //span.style.color = "#"+(rgb_building[0]).toString(16)+(rgb_building[1]).toString(16)+(rgb_building[2]).toString(16);
    } else {
        span.classList.add('shadow_black')
    }
    char++
    if(char == hub1_text_split.length){
        complete();
        return;
    }
}

function complete(){
    clearInterval(timer);
    timer = null;
}