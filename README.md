# 林间浅湾

一个基于 Three.js 和 WebGL 制作的微缩景观生态箱游戏。

场景包含树林、草地、沙滩、潮水、小鸭子、螃蟹、鱼群和漂流瓶。玩家可以观察潮水变化、旋转和缩放场景，并与场景中的生物和水面互动。

## 在线体验

[点击进入游戏](https://L1nkbr.github.io/miniature-coastal-terrarium/)

## 如何启动

### 本地启动

进入项目目录后运行：

```powershell
python -m http.server 4180
```

然后打开：

```text
http://localhost:4180/
```

也可以使用 VS Code 的 Live Server 插件启动。

## 操作方式

- 鼠标左键拖动：旋转镜头
- 鼠标右键拖动：移动镜头
- 鼠标滚轮：缩放场景
- 点击水面：产生水波和水滴声
- 点击小鸭子：查看介绍并播放鸭叫
- 点击水波图标：调节水位
- 点击风力图标：调节风力
- 开启自动潮汐：观察潮水从深水区向沙滩推进
- 点击右下角声音按钮：开启或关闭声音

## 技术

- Three.js
- WebGL
- JavaScript
- HTML / CSS
- Web Audio API

## 注意事项

项目使用 CDN 加载 Three.js 和部分图标，首次运行需要联网。

## 音频版权

鸭叫录音来自 Jonathon Jongsma，使用 CC BY-SA 3.0 许可。

详细信息请查看 [AUDIO-CREDITS.md](docs/AUDIO-CREDITS.md)。
