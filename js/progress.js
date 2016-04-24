//Author: Dingbao.ai [a.k.a ehaagwlke]

//Date: 2015/Nov/29
//Version: 0.2

//Date: 2015/Mar/30
//Version: 0.1

function HProgressBar(percentage){
    var canvas = genCanvas(),
        context = getContext(canvas);

    this.percentage = percentage || 0;
    this.draw = draw;

    function draw(pctg){
        var pctg = pctg || this.percentage;

        drawToCanvas(pctg);
        
        return getImageData();
    }

    function getImageData(){
        return context.getImageData(0, 0, canvas.width, canvas.height);
    }

    function drawToCanvas(percentage){
        var pctg = percentage || 0,
            endpos = calcEndPos(pctg),
            ctx = context;

        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0,0, canvas.width, canvas.height);

        ctx.strokeStyle = "green";
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = 'green';
        ctx.fillRect(0,0, endpos.x, endpos.y);
    }

    function genCanvas(){
        var cvs;
        cvs = document.createElement('canvas');
        
        cvs.style.cssText = "width:19px; height:6px; border:1px solid green";

        cvs.setAttribute('width', 19);
        cvs.setAttribute('height', 6);

        return cvs;
    }

    function getContext(can){
        return can.getContext('2d');
    }

    function calcEndPos(percentage){
        var pctg = percentage || 0,
            cwidth = canvas.width,
            cheight = canvas.height,
            endPos = {};

        endPos.x = parseInt(cwidth * pctg);
        endPos.y = cheight;
        return endPos;
    }
}