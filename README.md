# comfyui-teaching-kit · ComfyUI 教学工作流

![CI](https://github.com/Leslieryin/comfyui-teaching-kit/actions/workflows/ci.yml/badge.svg)

> **EN** — Two ready-to-load ComfyUI teaching workflows — Qwen-Image instruction editing and Z-Image text-to-image — built for quantized local models on an 8 GB GPU.

两个开箱即用的 ComfyUI 教学工作流，围绕**本地量化模型**（GGUF / fp8）搭建——显存友好、离线可跑，适合在教学中演示「文生图」与「图生图指令编辑」两条主线。

## 工作流

### `workflows/教学用工作流-qwen.json` — Qwen-Image 图像编辑（图生图）

15 节点。加载参考图后用自然语言指令改图（换姿势/视角/构图），核心节点：

- `UnetLoaderGGUF` + `CLIPLoaderGGUF`：Qwen-Image / Qwen-Image-Edit GGUF 量化模型
- `TextEncodeQwenImageEditPlus`：指令式编辑的文本编码（输入图 + 编辑指令）
- `QwenMultiangleCameraNode` / `LaoLi_Lineup`：多角度机位与构图辅助（第三方自定义节点，安装见「使用」第 2 条）
- `VAEEncode → KSampler → VAEDecode`：标准采样链，`ModelSamplingAuraFlow` 调调度

![Qwen-Image 编辑工作流：左侧加载参考图，中间的多角度相机节点输出镜头提示词，右侧是采样、解码与保存](docs/workflow-qwen.png)

### `workflows/教学用工作流-zimage.json` — Z-Image 文生图

10 节点。极简文生图教学样例：`UNETLoader`（Z-Image 权重）+ `CLIPTextEncode` 正/负提示词 + `KSampler` + `VAEDecode`，适合作为「第一个 ComfyUI 工作流」讲解节点连线概念。

![Z-Image 文生图工作流：提示词 → 潜空间 → 采样 → 解码 → 保存，共 10 个节点](docs/workflow-zimage.png)

> 截图为在 8 GB 显存机器上实际加载的效果，模型文件按本机已有的量化版本选择（工作流 JSON 里的默认文件名对应原作者的权重版本）。

## 使用

1. ComfyUI 中 `Load` 对应 JSON（或拖入画布）
2. 首次加载会提示缺失模型/节点，按红字提示安装：
   - **模型**：Qwen-Image-Edit 侧是 GGUF 的 UNet 与 CLIP；Z-Image 侧 UNet 为 safetensors（fp8/bf16）、CLIP 为 GGUF。另需各自的 VAE（放到 `models` 对应目录，工作流内节点会显示期望文件名）
   - **自定义节点**（qwen 工作流）：ComfyUI Manager 搜索安装 `LaoLi` / 多角度机位相关节点包；`*GGUF` 加载器需安装 `ComfyUI-GGUF`
3. 队列执行，出图在 `SaveImage`

## 教学建议

- 先讲 zimage 工作流（10 节点走完「提示词→潜空间→解码」全链路），再进 qwen 工作流讲图生图与指令编辑
- GGUF 量化让 8GB 级显存也能跑 Qwen 级模型，课堂演示不用依赖云端 API
- 让学生改 KSampler 的 steps/cfg 与提示词对比出图，是最直观的入门练习

## License

MIT（工作流 JSON 可自由使用与修改）
