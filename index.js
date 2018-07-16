(function (factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['alloyfinger'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node/CommonJS
        module.exports = factory(require('alloyfinger'));
    } else {
        // Browser globals
        window.SimpleCrop = factory(window.AlloyFinger);
    }
}(function (finger) {
    /**
     *
     * @param title 组件标题
     * @param src   初始图片路径
     * @param borderWidth 裁剪区域边框宽度
     * @param size  裁剪区域实际尺寸以及相对于裁剪容器位置
     * @param cropSizePercent 裁剪区域占画布比例
     * @param times 实际尺寸/显示尺寸
     * @param maskSize 裁剪容器实际尺寸
     * @param zIndex 样式层级
     * @param minScale 最小缩放倍数
     * @param controller 操控方式
     * @param maxScale 最大缩放倍数
     * @param isScaleFixed 缩放倍数范围是否固定
     * @param coverDraw 裁剪框绘制辅助线
     * @param scaleSlider 缩放滑动组件
     * @param funcBtns 功能按钮数组
     * @param cropCallback 确定裁剪回调函数
     * @param uploadCallback 重新上传回调函数
     * @param closeCallback 关闭回调函数
     */
    function SimpleCrop(params){

        this.id = 'crop-'+new Date().getTime();
        this.title = params.title;
        this.src = params.src;
        this.size = params.size;
        this.isScaleFixed = false;

        this._multiPoint = false;//是否开始多点触控

        this.cropSizePercent = params.cropSizePercent?params.cropSizePercent:0.5;//默认0.5则表示高度或者宽度最多占50%
        this.zIndex = params.zIndex?params.zIndex:9999;
        this.coverDraw = params.coverDraw?params.coverDraw:this.defaultCoverDraw;
        this.borderDraw = params.borderDraw?params.borderDraw:this.defaultBorderDraw;
        this.scaleSlider = params.scaleSlider?params.scaleSlider:true;

        /**
         * 操控方式
         * 默认只支持鼠标操控
         * mouse 鼠标
         * touch 手指
         */
        this.controller = params.controller?params.controller:['mouse'];

        /**
         * 默认功能按钮为重新上传、裁剪
         * upload 重新上传
         * crop 裁减
         * close 取消
         */
        this.funcBtns = params.funcBtns?params.funcBtns:['close','upload','crop'];

        this.construct();

        this.$cropMask = document.querySelector('#'+this.id+' .crop-mask');
        var maskStyle = window.getComputedStyle(this.$cropMask);
        var width = parseInt(maskStyle.getPropertyValue('width'));
        var height = parseInt(maskStyle.getPropertyValue('height'));

        this.times = (this.size.width/width>this.size.height/height)?this.size.width/width/this.cropSizePercent:this.size.height/height/this.cropSizePercent;
        this.maskSize = {};
        this.maskSize.width = width*this.times;
        this.maskSize.height = height*this.times;
        this.scaleTimes = 1;

        this.$cropCover = document.querySelector('#'+this.id+' .crop-cover');
        this.cropCoverContext = this.$cropCover.getContext('2d');
        this.$cropCover.width = this.maskSize.width;
        this.$cropCover.height = this.maskSize.height;
        this.$cropContent = document.querySelector('#'+this.id+' .crop-content');
        this.cropContentContext = this.$cropContent.getContext('2d');
        this.$cropContent.width = this.maskSize.width;
        this.$cropContent.height = this.maskSize.height;

        this.size.left = (this.maskSize.width-this.size.width)*1.0/2;
        this.size.top = (this.maskSize.height-this.size.height)*1.0/2;
        this.borderWidth = params.borderWidth?params.borderWidth:2;
        this.cropCallback = params.cropCallback;
        this.closeCallback = params.closeCallback;
        this.uploadCallback = params.uploadCallback;

        if(params.minScale&&params.maxScale){
            this.minScale = params.minScale;
            this.maxScale = params.maxScale;
            this.isScaleFixed = true;//如果缩放倍数范围是传参设置的，那么固定
        }

        this.borderDraw();
        this.coverDraw();
        this.bindEvent();
        this.load();
    }

    //html结构
    SimpleCrop.prototype.construct = function(){
        var html = '';
        html += '<div class="crop-component">';

        if(this.title){
            html += '<p class="crop-title">'+this.title+'</p>';
        }

        html += '<div class="crop-mask">'
        html += '<canvas class="crop-content"></canvas>';
        html += '<canvas class="crop-cover"></canvas>';
        html += '</div>';

        if(this.scaleSlider){
            html += '<div class="crop-scale">';
            html += '<div class="one-times-icon"></div>';
            html += '<div class="scale-container">';
            html += '<div class="scale-num"><span class="scale-value" style="width:0px;"></span><span class="scale-btn" style="left:-8px;"></span></div>';
            html += '</div>';
            html += '<div class="two-times-icon"></div>';
            html += '</div>';
        }

        if(this.funcBtns.length>0){
            html += '<div class="crop-btns">';

            if(this.funcBtns.includes('upload')){
                html += '<div class="upload-btn-container">';
                html += '<button class="upload-btn"></button>';
                html += '<input type="file" accept="image/png,image/jpeg">';
                html += '</div>';
            }
            if(this.funcBtns.includes('crop')){
                html += '<button class="crop-btn"></button>';
            }
            if(this.funcBtns.includes('close')){
                html += '<button class="crop-close"></button>';
            }

            html += '</div>';
        }

        html += '</div>';

        this.$target = document.createElement('div');
        this.$target.id = this.id;
        this.$target.classList.add('crop-whole-cover');
        this.$target.innerHTML = html;
        this.$target.style.zIndex = this.zIndex;
        document.body.appendChild(this.$target);
    };

    //默认绘制裁剪框
    SimpleCrop.prototype.defaultBorderDraw = function(){
        this.cropCoverContext.fillStyle = 'rgba(0,0,0,.64)';
        this.cropCoverContext.fillRect(0,0,this.$cropCover.width,this.$cropCover.height);
        this.cropCoverContext.fillStyle = '#ffffff';
        var width = this.borderWidth*2*this.times+this.size.width;
        var height = this.borderWidth*2*this.times+this.size.height;

        var borderRect = {
            left:(this.maskSize.width-width)*1.0/2,
            top:(this.maskSize.height-height)*1.0/2,
            width:width,
            height:height
        }
        this.cropCoverContext.fillRect(borderRect.left,borderRect.top,width,height);

        //边框四个角加粗
        var len = 3;
        var percent = 0.05;
        var outWidth = width*percent;
        var outHeight = height*percent;
        this.cropCoverContext.fillRect(borderRect.left-len,borderRect.top-len,outWidth,outHeight);//左上角
        this.cropCoverContext.fillRect(borderRect.left+width-outWidth+len,borderRect.top-len,outWidth,outHeight);//右上角
        this.cropCoverContext.fillRect(borderRect.left-len,borderRect.top+height-outHeight+len,outWidth,outHeight);//左下角
        this.cropCoverContext.fillRect(borderRect.left+width-outWidth+len,borderRect.top+height-outHeight+len,outWidth,outHeight);//右下角

        this.cropCoverContext.clearRect((this.maskSize.width-this.size.width)*1.0/2,(this.maskSize.height-this.size.height)*1.0/2,this.size.width,this.size.height);
    };

    //默认绘制辅助线
    SimpleCrop.prototype.defaultCoverDraw = function(){

    };

    //加载图片
    SimpleCrop.prototype.load = function(){
        var self = this;
        if(!self.$image){
            self.$image = new Image();
        }
        self.$image.src = self.src;
        self.$image.onload = function(){
            self.contentRect = {
                left:(self.maskSize.width-self.$image.width)*1.0/2,
                top:(self.maskSize.height-self.$image.height)*1.0/2,
                width:self.$image.width,
                height:self.$image.height
            };

            if(!self.isScaleFixed){//默认最大缩放倍数为2，最小缩放倍数为图片刚好填满裁切区域
                self.maxScale = 1;
                if(self.size.width*1.0/self.size.height>self.$image.width*1.0/self.$image.height){
                    self.minScale = self.size.width*1.0/self.$image.width;
                }else{
                    self.minScale = self.size.height*1.0/self.$image.height;
                }
                if(self.minScale>=self.maxScale){
                    self.maxScale = self.minScale;
                }
            }

            self.cropContentContext.clearRect(0,0,self.maskSize.width,self.maskSize.height);
            self.cropContentContext.drawImage(self.$image,self.contentRect.left,self.contentRect.top,self.$image.width,self.$image.height);
            //缩放滑动条回归初始状态
            var evt = new MouseEvent('click');
            self.$scaleOneTimes.dispatchEvent(evt);
        }
    };

    //显示
    SimpleCrop.prototype.show = function(src){
        if(src){
            this.src = src;
            this.load();
        }
        this.$target.style.display = 'block';
    },

    //隐藏
    SimpleCrop.prototype.hide = function(){
        this.$target.style.display = 'none';
    },

    //绑定事件
    SimpleCrop.prototype.bindEvent = function(){
        //获取事件相关dom元素
        var self = this;

        //裁剪
        if(self.funcBtns.includes('crop')){
            self.$cropBtn = document.querySelector('#'+self.id+' .crop-btn');
            self.$cropBtn.addEventListener('click',function(){
                self.$resultCanvas = document.createElement('canvas');
                self.$resultCanvas.width = self.size.width;
                self.$resultCanvas.height = self.size.height;
                self.resultContext = self.$resultCanvas.getContext('2d');
                if(self.scaleTimes>=1){
                    var rect = self.coverRectToContentRect(self.size);
                    self.resultContext.drawImage(self.$cropContent,rect.left,rect.top,rect.width,rect.height,0,0,self.size.width,self.size.height);
                }else{
                    self.resultContext.drawImage(self.$cropContent,self.size.left,self.size.top,self.size.width,self.size.height,0,0,self.size.width,self.size.height);
                }
                self.cropCallback();
            },false);
        }

        //上传
        if(self.funcBtns.includes('upload')){
            self.$uploadBtn = document.querySelector('#'+self.id+' .upload-btn-container');
            self.$uploadInput = document.querySelector('#'+self.id+' .upload-btn-container input');
            self.$uploadBtn.addEventListener('change',function(evt){
                var files = evt.target.files;
                if(files.length>0){
                    if(self.uploadCallback){
                        self.uploadCallback(files[0]);
                    }else{
                        self.fileToSrc(files[0],function(src){
                            self.src = src;
                            self.load();
                        });
                    }
                }
                self.$uploadInput.value = '';//清空value属性，从而保证用户修改文件内容但是没有修改文件名时依然能上传成功
            },false);
        }

        //关闭
        if(self.funcBtns.includes('close')){
            self.$closeBtn = document.querySelector('#'+self.id+' .crop-close');
            self.$closeBtn.addEventListener('click',function(){
                self.hide();
                if(self.closeCallback){
                    self.closeCallback();
                }
            },false);
        }

        //滑动缩放
        if(self.scaleSlider){
            self.$scaleBtn = document.querySelector('#'+self.id+' .scale-btn');
            self.$scaleNum = document.querySelector('#'+self.id+' .scale-num');
            self.$scaleOneTimes = document.querySelector('#'+self.id+' .one-times-icon');
            self.$scaleTwoTimes = document.querySelector('#'+self.id+' .two-times-icon');
            self.$scaleContainer = document.querySelector('#'+self.id+' .scale-container');
            self.$scaleValue = document.querySelector('#'+self.id+' .scale-value');

            self.scaleDownX = 0;
            self.scaleInitLeft = self.$scaleBtn.getBoundingClientRect().left;
            self.scaleCurLeft = self.scaleInitLeft;
            self.scaleWidth = self.$scaleNum.getBoundingClientRect().width;


            //滑动按钮鼠标按下
            self.$scaleBtn.addEventListener('mousedown',function(ev){
                self.scaleDownX = ev.clientX;
            },false);
            //滑动按钮鼠标滑动
            self.$scaleContainer.addEventListener('mousemove',function(ev){
                var pointX = ev.clientX;
                if(self.scaleDownX>0){
                    var moveX = pointX - self.scaleDownX;
                    var newCurLeft = self.scaleCurLeft+moveX;
                    if(newCurLeft>=self.scaleInitLeft&&newCurLeft<=(self.scaleWidth+self.scaleInitLeft)){
                        var lastMoveX = parseFloat(self.$scaleBtn.getAttribute('moveX'));
                        if(!lastMoveX){
                            lastMoveX = 0;
                        }
                        var curMoveX = lastMoveX+moveX;
                        self.scaleDownX = pointX;
                        self.scaleMove(curMoveX);
                    }
                }
            },false);
            //缩放条点击
            self.$scaleBtn.addEventListener('click',function(ev){//滑动按钮点击
                ev.stopPropagation();
            },false);
            self.$scaleContainer.addEventListener('click',function(ev){
                var rect = self.$scaleBtn.getBoundingClientRect();
                if(self.scaleDownX<=0){
                    self.scaleDownX = rect.left+rect.width*1.0/2;
                }
                if(self.scaleDownX>0){
                    var pointX = ev.clientX;
                    var moveX = pointX - self.scaleDownX;
                    var newCurLeft = self.scaleCurLeft+moveX;
                    if(newCurLeft>=self.scaleInitLeft&&newCurLeft<=(self.scaleWidth+self.scaleInitLeft)){
                        var lastMoveX = parseFloat(self.$scaleBtn.getAttribute('moveX'));
                        if(!lastMoveX){
                            lastMoveX = 0;
                        }
                        var curMoveX = lastMoveX+moveX;
                        self.scaleMove(curMoveX);
                        self.scaleDownX = 0;//鼠标移动缩放只能由鼠标在缩放按钮上按下触发
                    }
                }
            },false);
            //滑动按钮超出范围
            self.$scaleContainer.addEventListener('mouseleave',function(ev){
                self.scaleDownX = 0;
            },false);
            //滑动按钮鼠标松开
            self.$scaleContainer.addEventListener('mouseup',function(ev){
                self.scaleDownX = 0;
            },false);
            //最小缩放按钮点击
            self.$scaleOneTimes.addEventListener('click',function(ev){
                self.scaleMove(0);
            },false);
            //最大缩放按钮点击
            self.$scaleTwoTimes.addEventListener('click',function(ev){
                self.scaleMove(self.scaleWidth);
            },false);
        }

        //画布相关事件
        self.downPoint = [];

        /**
         * 触摸事件
         */
        if(self.controller.includes('touch')){

            //裁剪区域触摸开始
            self.$cropMask.addEventListener('touchstart',function(){
                var touch = event.touches[0];
                self.downPoint = [touch.clientX,touch.clientY];
            });
            //裁剪区域触摸移动
            self.$cropMask.addEventListener('touchmove',function(){
                var touch = event.touches[0];
                var point = [touch.clientX,touch.clientY];
                self.move(point);
            });
            //裁剪区域触摸结束
            self.$cropMask.addEventListener('touchend',function(){
                self.downPoint = [];
            });
            //裁剪区域触摸取消
            self.$cropMask.addEventListener('touchcancel',function(){
                self.downPoint = [];
            });

            //复杂手势事件
            var lastScale = 1;
            new finger(self.$cropMask, {
                multipointStart: function () {
                    self._multiPoint = true;//多点触摸开始
                },
                pinch: function (evt) {//缩放
                    var scale = evt.scale;
                    var newScale = self.scaleTimes/lastScale*scale;
                    if(newScale>=self.minScale&&newScale<=self.maxScale){
                        self.scaleTimes = newScale
                        lastScale = scale;
                        self.scale();
                    }else{
                        /**
                         * 浮点数计算存在误差会导致缩放时很难回到初始状态；
                         * 且手指触摸缩放和滑动缩放不一样，并不存在初始化状态按钮；
                         * 因此需要加上强制回归的逻辑
                         */
                        if(newScale!=self.scaleTimes){
                            if(Math.abs(newScale-self.minScale)>Math.abs(newScale-self.maxScale)){
                                newScale = self.maxScale;
                            }else{
                                newScale = self.minScale;
                            }
                            self.scaleTimes = newScale;
                            self.scale();
                        }
                    }
                },
                multipointEnd: function () {
                    self._multiPoint = false;//多点触摸结束
                    lastScale = 1;
                },
            });
        }

        /**
         * 鼠标事件
         */
        if(self.controller.includes('mouse')){

            //裁剪区域鼠标按下
            self.$cropMask.addEventListener('mousedown',function(ev){
                self.downPoint = [ev.clientX,ev.clientY];
            },false);
            //裁剪区域鼠标移动
            self.$cropMask.addEventListener('mousemove',function(ev){
                var point = [ev.clientX,ev.clientY];
                self.move(point);
            },false);
            //裁剪区域鼠标松开
            self.$cropMask.addEventListener('mouseup',function(ev){
                self.downPoint = [];
            },false);
            //裁剪区域超出范围
            self.$cropMask.addEventListener('mouseleave',function(ev){
                self.downPoint = [];
            },false);
        }
    };

    //滑动按钮移动
    SimpleCrop.prototype.scaleMove = function(curMoveX){
        this.$scaleBtn.style.transform = 'translateX('+curMoveX+'px)';
        this.$scaleValue.style.width = curMoveX+'px';
        this.$scaleBtn.setAttribute('moveX',curMoveX);
        this.scaleCurLeft = this.scaleInitLeft+curMoveX;
        this.scaleTimes = this.minScale+curMoveX*1.0/this.scaleWidth*(this.maxScale-this.minScale);
        this.scale();
    };

    //缩放
    SimpleCrop.prototype.scale = function(){
        var coverTect = this.contentRectToCoverRect(this.contentRect);
        coverTect = this.rectLimit(coverTect);
        this.contentRect = this.coverRectToContentRect(coverTect);

        if(this.scaleTimes>=1){
            this.$cropContent.style.transform = 'scale('+this.scaleTimes+')';
        }
        this.drawContentImage();
    }

    //移动
    SimpleCrop.prototype.move = function(point){
        if(this.downPoint.length==2&&!this._multiPoint){
            var moveX = point[0] - this.downPoint[0];
            var moveY = point[1] - this.downPoint[1];

            var newContentRect = {
                left:this.contentRect.left+moveX*this.times,
                top:this.contentRect.top+moveY*this.times,
                width:this.contentRect.width,
                height:this.contentRect.height
            };

            var coverRect = this.contentRectToCoverRect(newContentRect);

            var isChanged = false;
            if(coverRect.left>this.size.left||(coverRect.left+coverRect.width)<(this.size.left+this.size.width)){
                newContentRect.left = this.contentRect.left;
            }else{
                var lastMoveX = parseFloat(this.$cropContent.getAttribute('moveX'));
                if(!lastMoveX){
                    lastMoveX = 0;
                }
                var curMoveX = lastMoveX+moveX;
                this.$cropContent.setAttribute('moveX',curMoveX);
                isChanged = true;
            }
            if(coverRect.top>this.size.top||(coverRect.top+coverRect.height)<(this.size.top+this.size.height)){
                newContentRect.top = this.contentRect.top;
            }else{
                var lastMoveY = parseFloat(this.$cropContent.getAttribute('moveY'));
                if(!lastMoveY){
                    lastMoveY = 0;
                }
                var curMoveY = lastMoveY+moveY;
                this.$cropContent.setAttribute('moveY',curMoveY);
                isChanged = true;
            }
            if(isChanged){
                this.contentRect = newContentRect;
                this.drawContentImage()
            }
            this.downPoint = point;
        }
    }

    //绘制内容图像
    SimpleCrop.prototype.drawContentImage = function(){
        if(this.scaleTimes>=1){
            this.cropContentContext.clearRect(0,0,this.maskSize.width,this.maskSize.height);
            this.cropContentContext.drawImage(this.$image,this.contentRect.left,this.contentRect.top,this.$image.width,this.$image.height);
        }else{
            /**
             * 缩小和放大的坐标转换规律一样，但是绘制方法有区别；
             * 主要是因为放大时画布超出可视容器，画布中不显示的，可视容器同样也不需要显示，正常绘制即可；
             * 但是缩小时画布尺寸小于可视容器，画布中不显示，可视容器不一定不显示，此时就需要假定一个坐标和画布一样，但是可视尺寸和可视容器一样的新的画布来绘制。
             * @type {Element}
             */
            var $tempCanvas = document.createElement('canvas');
            $tempCanvas.width = this.maskSize.width*1.0/this.scaleTimes;
            $tempCanvas.height = this.maskSize.height*1.0/this.scaleTimes;
            var tempContext = $tempCanvas.getContext('2d');
            var tempLeft = ($tempCanvas.width-this.maskSize.width)*1.0/2+this.contentRect.left;
            var tempTop = ($tempCanvas.height-this.maskSize.height)*1.0/2+this.contentRect.top;
            tempContext.drawImage(this.$image,tempLeft,tempTop,this.$image.width,this.$image.height);
            this.cropContentContext.clearRect(0,0,this.maskSize.width,this.maskSize.height);
            this.cropContentContext.drawImage($tempCanvas,0,0,this.maskSize.width,this.maskSize.height);
        }
    },

    //坐标转换
    SimpleCrop.prototype.contentRectToCoverRect = function(contentRect){
        var coverRect = {
            left:contentRect.left*this.scaleTimes,
            top:contentRect.top*this.scaleTimes,
            width:contentRect.width*this.scaleTimes,
            height:contentRect.height*this.scaleTimes
        };
        var overLeft = this.maskSize.width*(this.scaleTimes-1)*1.0/2;
        var overTop = this.maskSize.height*(this.scaleTimes-1)*1.0/2;

        coverRect.left = coverRect.left-overLeft;
        coverRect.top = coverRect.top-overTop;

        return coverRect;
    };
    SimpleCrop.prototype.coverRectToContentRect = function(coverRect){
        var overLeft = this.maskSize.width*(this.scaleTimes-1)*1.0/2;
        var overTop = this.maskSize.height*(this.scaleTimes-1)*1.0/2;

        var contentRect = {
            left:(coverRect.left+overLeft)*1.0/this.scaleTimes,
            top:(coverRect.top+overTop)*1.0/this.scaleTimes,
            width:coverRect.width*1.0/this.scaleTimes,
            height:coverRect.height*1.0/this.scaleTimes
        }

        return contentRect;
    };

    //坐标限制
    SimpleCrop.prototype.rectLimit = function(coverRect){
        if(coverRect.left>=this.size.left||Math.abs(coverRect.left-this.size.left)<=0){
            coverRect.left = this.size.left;
        }else if((coverRect.left+coverRect.width)<(this.size.left+this.size.width)){
            coverRect.left = this.size.left+this.size.width-coverRect.width;
        }
        if(coverRect.top>=this.size.top||Math.abs(coverRect.top-this.size.top)<=0){
            coverRect.top = this.size.top;
        }else if((coverRect.top+coverRect.height)<(this.size.top+this.size.height)){
            coverRect.top = this.size.top+this.size.height-coverRect.height;
        }

        return coverRect;
    };

    //file转image
    SimpleCrop.prototype.fileToSrc = function(file,callback){
        var reader = new FileReader();
        reader.onload = function (e) {
            callback(e.target.result);
        }
        reader.readAsDataURL(file)
    };

    return SimpleCrop;
}));