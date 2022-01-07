//memo for the numbers of the different things in the museum installation
//8 WG arm
//7 BB----
//6 MB----
//5 = smallBowl
//4 DB arm
//3 BB arm
//2 coffee
//1 not available
//0 not available

// Dad
let remapArray = [11,2,9,5,6,7,10,8]
let has2Actuators = [true, false, true, false, false, true, true, true]
let remapArray2ndActuator = [4,13,14,14,4,3,12,13]

//thumpBits
//let remapArray = [0,1,2,3,4,5,6,7]
//let has2Actuators = [false, false, false, false, false, false, false, false]
//let remapArray2ndActuator = [0,0,0,0,0,0,0,0]


let myWaitMicros = 4000
let tickDuration = 100
//let instrumentName = "BunP"
let instrumentName = "DadP"
let myFetchMessage = "fetchDad"
radio.setGroup(84) // clockticks and shit arrive on this group 
serial.redirect(SerialPin.P0, SerialPin.P1, 115200)
let myData = ""
let internalStep = 0
let lastTick = 0
// show a square when we turn on
basic.showLeds(`
. . . . .
. # # # .
. # # # .
. # # # .
. . . . .
`,0)

//prepare some variables
let inc = 0 
let globalDebounce = 0;
let globalDebounceDuration = 100

//set up the pins we are using
pins.setPull(DigitalPin.P2, PinPullMode.PullUp)
pins.setPull(DigitalPin.P8, PinPullMode.PullUp)
pins.setPull(DigitalPin.P16, PinPullMode.PullUp)

//interrupt to read button press next
pins.onPulsed(DigitalPin.P2, PulseValue.High, function () {
        if(input.runningTime()>globalDebounce){
            requestNextSequence() //the function to make an i2c request
            globalDebounce = input.runningTime() + globalDebounceDuration //debounce, google it
    }     
 })

//interrupt to read button press prev
pins.onPulsed(DigitalPin.P8, PulseValue.High, function () {
     if(input.runningTime()>globalDebounce){
        //requestPrevSequence()
        requestRandomSequence()
        globalDebounce = input.runningTime() + globalDebounceDuration
    }
 })

//interrupt to read button press play
pins.onPulsed(DigitalPin.P16, PulseValue.High, function () {
    if(input.runningTime()>globalDebounce){
        playPause()
        globalDebounce = input.runningTime() + globalDebounceDuration
    }
 })

//change tempo
input.onButtonPressed(Button.A, function () {
requestNextSequence()
/*
tickDuration +=10
if(tickDuration < 10){
    tickDuration =10
}
*/
})

input.onButtonPressed(Button.B, function () {
requestRandomSequence()
/*
tickDuration -=10
if(tickDuration < 10){
    tickDuration =10
}
*/
})


function requestRandomSequence(){
    serial.writeString("r")
    basic.showString("R",0)
}


function requestNextSequence(){
    serial.writeString("9") //secret code for the ESP8266 to tell it we want a new seq
    /*basic.showLeds(`
    . . . # .
    . . # # .
    . # # # .
    . . # # .
    . . . # .
    `,0)
    */
    
    basic.showLeds(`
    . # . . .
    . # # . .
    . # # # .
    . # # . .
    . # . . .
    `,0)
    
}

function requestPrevSequence(){
    //serial.writeString("9")
    basic.showLeds(`
    . . . # .
    . . # # .
    . # # # .
    . . # # .
    . . . # .
    `,0)
}


//shit we need to do all the time
basic.forever(function () {
    if(isPlaying){
        if(input.runningTime()>lastTick + tickDuration){
            lastTick = input.runningTime()
            serial.writeString(""+internalStep) // request this steps data from ESP8266
            basic.showNumber(internalStep+1,0)
            internalStep = (internalStep+1) % 8
        }
    }
})



let isPlaying = false
function playPause(){
    isPlaying = !isPlaying
    if(!isPlaying){
        basic.showLeds(`
        . . . . .
        . # # # .
        . # # # .
        . # # # .
        . . . . .
        `,0)
    } else {
        internalStep = 1
        lastTick = input.runningTime()
        basic.showNumber(internalStep,0)
        serial.writeString(""+internalStep) // request this steps data from ESP8266
    }
}


function remapDigitNumber(numby: number){
    //PARSE INPUT
    let bitCheckMask = 0b0000000000000001
    let remappedNumby = 0
    let remappedNumbyString = ""  //for debug
    for (let i = 0; i <= 16; i++) {            
        if (numby & (bitCheckMask << i)){
            //let addThis = 2**remapArray[i] // what we want to add as a bit
            let addThis = 0b0000000000000001 << remapArray[i]
            remappedNumby = remappedNumby | addThis                 //Slap the bit on the variable using bitmask "OR"
            if(has2Actuators[i]){
                let alsoAddThis = 0b0000000000000001 << remapArray2ndActuator[i]
                remappedNumby = remappedNumby | alsoAddThis       //Slap the bit on the variable using bitmask "OR"
            }
        }
    }
return remappedNumby
}

function printNumberAsBin(x: number){
    let binString = ""
    let mask = 0b1000000000000000
    for (let i = 0; i <= 15; i++) {            
        if (x & (mask >> i)){
            binString += "1"    
        } else {
            binString += "0"    
        }
    }
    serial.writeLine(binString)
}

//printNumberAsBin(myBin)
//printNumberAsBin(remapDigitNumber(myBin))

radio.onReceivedValue(function (name: string, value: number) {
    if(name == "t"){ //its a clockTick
        let currentStep = value % 8 // value should contain currentStep, we want to make sure its less than 8
        control.waitMicros(myWaitMicros)
        serial.writeString(""+ currentStep) // request this steps data from ESP8266
        isPlaying = false
    } else if(name == myFetchMessage){
        requestNextSequence()
    }
})

serial.onDataReceived(serial.delimiters(Delimiters.Dollar), function () {
    myData = serial.readString()
    let endOfNumber = myData.indexOf("$")
    let digit = myData.substr(0,endOfNumber)
    let digitNumber = parseInt(digit)
    let remappedDigitNumber = remapDigitNumber(digitNumber)
    // if(remappedDigitalNumber > 0){ 
    // }
    if(remappedDigitNumber>0){
        radio.setGroup(83)
        radio.sendValue(instrumentName, remappedDigitNumber)
        radio.setGroup(84)
        led.toggleAll()
    }
})