[![logo](https://services.dev.arxiv.org/html/static/arxiv-logomark-small-white.svg)Back to arXiv](https://arxiv.org/)

[Back to abstract page](https://arxiv.org/abs/2412.03685v1)

[![logo](https://services.dev.arxiv.org/html/static/arxiv-logo-one-color-white.svg)Back to arXiv](https://arxiv.org/)

This is **experimental HTML** to improve accessibility. We invite you to report rendering errors. Use Alt+Y to toggle on accessible reporting links and Alt+Shift+Y to toggle off. Learn more [about this project](https://info.arxiv.org/about/accessible_HTML.html) and [help improve conversions](https://info.arxiv.org/help/submit_latex_best_practices.html).


[Why HTML?](https://info.arxiv.org/about/accessible_HTML.html) [Report Issue](https://arxiv.org/html/2412.03685v1/#myForm) [Back to Abstract](https://arxiv.org/abs/2412.03685v1) [Download PDF](https://arxiv.org/pdf/2412.03685v1)

## Table of Contents

01. [1 Introduction](https://arxiv.org/html/2412.03685v1#S1 "In Sprite Sheet Diffusion: Generate Game Character for Animation")
02. [2 Dataset and Task](https://arxiv.org/html/2412.03685v1#S2 "In Sprite Sheet Diffusion: Generate Game Character for Animation")
03. [3 Related Work](https://arxiv.org/html/2412.03685v1#S3 "In Sprite Sheet Diffusion: Generate Game Character for Animation")    1. [3.1 Image2Pose](https://arxiv.org/html/2412.03685v1#S3.SS1 "In 3 Related Work ‣ Sprite Sheet Diffusion: Generate Game Character for Animation")
    2. [3.2 Image2Image](https://arxiv.org/html/2412.03685v1#S3.SS2 "In 3 Related Work ‣ Sprite Sheet Diffusion: Generate Game Character for Animation")
    3. [3.3 Image2Video](https://arxiv.org/html/2412.03685v1#S3.SS3 "In 3 Related Work ‣ Sprite Sheet Diffusion: Generate Game Character for Animation")
04. [4 Approach](https://arxiv.org/html/2412.03685v1#S4 "In Sprite Sheet Diffusion: Generate Game Character for Animation")    1. [4.1 Training Procedure](https://arxiv.org/html/2412.03685v1#S4.SS1 "In 4 Approach ‣ Sprite Sheet Diffusion: Generate Game Character for Animation")
    2. [4.2 Baseline and Comparison](https://arxiv.org/html/2412.03685v1#S4.SS2 "In 4 Approach ‣ Sprite Sheet Diffusion: Generate Game Character for Animation")       1. [4.2.1 Stable Diffusion with ControlNet and IPAdaptor Integration (SD-IPCN)](https://arxiv.org/html/2412.03685v1#S4.SS2.SSS1 "In 4.2 Baseline and Comparison ‣ 4 Approach ‣ Sprite Sheet Diffusion: Generate Game Character for Animation")
       2. [4.2.2 AnimateAnyone](https://arxiv.org/html/2412.03685v1#S4.SS2.SSS2 "In 4.2 Baseline and Comparison ‣ 4 Approach ‣ Sprite Sheet Diffusion: Generate Game Character for Animation")
05. [5 Experiments](https://arxiv.org/html/2412.03685v1#S5 "In Sprite Sheet Diffusion: Generate Game Character for Animation")
06. [6 Plan](https://arxiv.org/html/2412.03685v1#S6 "In Sprite Sheet Diffusion: Generate Game Character for Animation")
07. [A Visual Illustration](https://arxiv.org/html/2412.03685v1#A1 "In Sprite Sheet Diffusion: Generate Game Character for Animation")
08. [B Dataset](https://arxiv.org/html/2412.03685v1#A2 "In Sprite Sheet Diffusion: Generate Game Character for Animation")
09. [C Framework](https://arxiv.org/html/2412.03685v1#A3 "In Sprite Sheet Diffusion: Generate Game Character for Animation")
10. [D Qualitative Comparison](https://arxiv.org/html/2412.03685v1#A4 "In Sprite Sheet Diffusion: Generate Game Character for Animation")
11. [References](https://arxiv.org/html/2412.03685v1#bib "References")

[License: CC BY 4.0](https://info.arxiv.org/help/license/index.html#licenses-available)

arXiv:2412.03685v1 \[cs.GR\] 04 Dec 2024

# Sprite Sheet Diffusion: Generate Game Character for Animation

Report issue for preceding element

Cheng-An Hsieh

chengan2@andrew.cmu.edu
Jing Zhang

jingzha4@andrew.cmu.edu
Ava Yan

lany2@andrew.cmu.edu

Report issue for preceding element

## 1 Introduction

Report issue for preceding element

In 2D game development, creating character animations is a crucial step. Illustrators typically start by designing a main character image, which serves as the foundation for all animations. Subsequently, they draw the character in various actions (such as running) and poses (different key frames of the character running) to create a smooth motion sequence. This process demands meticulous manual effort to maintain consistency in design, proportions, and style across multiple frames, making it both time-intensive and laborious. (Figure [1](https://arxiv.org/html/2412.03685v1#A1.F1 "Figure 1 ‣ Appendix A Visual Illustration ‣ Sprite Sheet Diffusion: Generate Game Character for Animation"))

Report issue for preceding element

Generative models, particularly diffusion models, offer a transformative approach to automate the creation of sprite sheets. Known for their ability to generate diverse images, diffusion models can be adapted to generate character animations, significantly reducing manual effort, accelerating animation workflows, and enabling new creative possibilities in game development.

Report issue for preceding element

In this work, we innovatively adapt the video generation method Animate Anyone (Hu, [2024](https://arxiv.org/html/2412.03685v1#bib.bib5 "")) by enhancing key components for better performance. To ensure consistent appearance and preserve fine details, we incorporate features from ReferenceNet into the denoising UNet using spatial attention mechanisms. For precise pose control, we implement a lightweight Pose Guider that integrates pose signals into the denoising process. To achieve temporal stability across multiple frames, we employ a motion module. We also construct a game sprite sheet dataset comprising character motion images and their corresponding pose images. Despite the dataset’s small size, our experiments demonstrate that the model performs effectively in generating character action sequences when initialized with pretrained weights from Stable Diffusion (SD) model.

Report issue for preceding element

## 2 Dataset and Task

Report issue for preceding element

The proposed task involves generating an action sequence of a game character conditioned on an initial game character reference image (Figure [2(a)](https://arxiv.org/html/2412.03685v1#A2.F2.sf1 "In Figure 2 ‣ Appendix B Dataset ‣ Sprite Sheet Diffusion: Generate Game Character for Animation")), a specified pose sequence (Figure [2(b)](https://arxiv.org/html/2412.03685v1#A2.F2.sf2 "In Figure 2 ‣ Appendix B Dataset ‣ Sprite Sheet Diffusion: Generate Game Character for Animation")), and the resulting action sequence (Figure [2(c)](https://arxiv.org/html/2412.03685v1#A2.F2.sf3 "In Figure 2 ‣ Appendix B Dataset ‣ Sprite Sheet Diffusion: Generate Game Character for Animation")). The reference image defines the character’s appearance, while the pose sequence outlines the intended actions. The goal is to create a sequence of images that depict the character performing these actions, maintaining consistency with the reference image. Formally, let C𝐶Citalic\_C denote the reference image of the game character, P={p1,p2,…,pn}𝑃subscript𝑝1subscript𝑝2…subscript𝑝𝑛P=\\{p\_{1},p\_{2},\\dots,p\_{n}\\}italic\_P = { italic\_p start\_POSTSUBSCRIPT 1 end\_POSTSUBSCRIPT , italic\_p start\_POSTSUBSCRIPT 2 end\_POSTSUBSCRIPT , … , italic\_p start\_POSTSUBSCRIPT italic\_n end\_POSTSUBSCRIPT } denote the pose sequence, where each pisubscript𝑝𝑖p\_{i}italic\_p start\_POSTSUBSCRIPT italic\_i end\_POSTSUBSCRIPT represents a specific pose in the sequence, and I^={i^1,i^2,…,i^n}^𝐼subscript^𝑖1subscript^𝑖2…subscript^𝑖𝑛\\hat{I}=\\{\\hat{i}\_{1},\\hat{i}\_{2},\\dots,\\hat{i}\_{n}\\}over^ start\_ARG italic\_I end\_ARG = { over^ start\_ARG italic\_i end\_ARG start\_POSTSUBSCRIPT 1 end\_POSTSUBSCRIPT , over^ start\_ARG italic\_i end\_ARG start\_POSTSUBSCRIPT 2 end\_POSTSUBSCRIPT , … , over^ start\_ARG italic\_i end\_ARG start\_POSTSUBSCRIPT italic\_n end\_POSTSUBSCRIPT } denote the generated image sequence, where i^isubscript^𝑖𝑖\\hat{i}\_{i}over^ start\_ARG italic\_i end\_ARG start\_POSTSUBSCRIPT italic\_i end\_POSTSUBSCRIPT corresponds to the character in pose pisubscript𝑝𝑖p\_{i}italic\_p start\_POSTSUBSCRIPT italic\_i end\_POSTSUBSCRIPT. The model learns a mapping f:(C,P)→I^:𝑓→𝐶𝑃^𝐼f:(C,P)\\to\\hat{I}italic\_f : ( italic\_C , italic\_P ) → over^ start\_ARG italic\_I end\_ARG such that each i^i=f⁢(C,pi)subscript^𝑖𝑖𝑓𝐶subscript𝑝𝑖\\hat{i}\_{i}=f(C,p\_{i})over^ start\_ARG italic\_i end\_ARG start\_POSTSUBSCRIPT italic\_i end\_POSTSUBSCRIPT = italic\_f ( italic\_C , italic\_p start\_POSTSUBSCRIPT italic\_i end\_POSTSUBSCRIPT ).

Report issue for preceding element

Since this is a novel problem, no existing datasets fully meet the requirements, but we found publicly available sprite sheet datasets, and applied pose detection algorithms or manual pose annotations to generate corresponding pose sequences. We curated the dataset from GameArt2D111 [https://www.gameart2d.com/freebies.html](https://www.gameart2d.com/freebies.html ""), which contains high-quality, pre-cropped, and uniformly formatted sprite sequences to serve as our ground truth sequences. We collected 619 (reference image, pose image, target image) pairs across 75 action sequences from 16 characters. These pairs were split into training and testing sets at the character level, with 463 (reference image, pose image, target image) pairs from 55 action sequences of 11 characters used for training, and 156 (reference image, pose image, target image) pairs from 20 action sequences of 5 characters for testing. See Figure [2](https://arxiv.org/html/2412.03685v1#A2.F2 "Figure 2 ‣ Appendix B Dataset ‣ Sprite Sheet Diffusion: Generate Game Character for Animation") for an example.

Report issue for preceding element

The evaluation comprises both qualitative and quantitative assessments. For qualitative analysis, we manually evaluate five examples to verify alignment with conditioned images and detail consistency across frames. For quantitative analysis, we evaluate the generated motion frames based on: (1) the similarity to the reference motion frames; and (2) the subject consistency within the generated motion frames for each motion. This is because we not only want the generated character to align with the given character image, but we also want our method to be able to generate a consistent character across various motion frames. To evaluate the similarity compared to the reference image, we use the Structural Similarity Index Measure (SSIM) (Wang et al., [2004](https://arxiv.org/html/2412.03685v1#bib.bib10 "")) to assess structural similarity in luminance and contrast, the Peak Signal-to-Noise Ratio (PSNR) (Horé and Ziou, [2010](https://arxiv.org/html/2412.03685v1#bib.bib4 "")) to evaluate the pixel-wise difference, and the Learned Perceptual Image Patch Similarity (LPIPS) (Zhang et al., [2018](https://arxiv.org/html/2412.03685v1#bib.bib15 "")) to measure perceptual differences aligned with human judgment. To evaluate the subject consistency, we utilize the DINO feature similarity score proposed by Huang et al. ( [2024](https://arxiv.org/html/2412.03685v1#bib.bib6 "")).

Report issue for preceding element

## 3 Related Work

Report issue for preceding element

### 3.1 Image2Pose

Report issue for preceding element

2D human pose estimation (HPE) is a task that aims to predict the 2D spatial coordinates of human body keypoints from images (Zheng et al., [2023](https://arxiv.org/html/2412.03685v1#bib.bib16 "")). Early works, such as DeepPose (Toshev and Szegedy, [2014](https://arxiv.org/html/2412.03685v1#bib.bib9 "")), adopted regression-based approaches, directly predicting joint coordinates from the input image. Later, heatmap-based approaches became dominant, as they estimate joint positions through probability maps and achieve higher spatial precision (e.g., DW-Pose (Tian et al., [2021](https://arxiv.org/html/2412.03685v1#bib.bib8 ""))). Some methods target single-person scenarios, while others target multi-person scenarios (e.g. OpenPose (Cao et al., [2017](https://arxiv.org/html/2412.03685v1#bib.bib1 ""))).

Report issue for preceding element

Despite the success of pose estimation in human-centered tasks, we found that these models, such as DW-Pose and OpenPose, do not generalize well to illustrations in sprite sheets. Game characters often have exaggerated proportions, costumes that obscure body parts, or poses that deviate significantly from standard human postures, presenting unique challenges. There is very limited research on pose estimation for illustrations; in fact, the only work we could find is the transfer learning approach proposed by Chen and Zwicker ( [2022](https://arxiv.org/html/2412.03685v1#bib.bib2 "")), which adapts human pose estimation models for illustrated characters. However, given that pose estimation is only a minor component in our pipeline and we do not require large-scale datasets, we manually annotate poses for unsuccessful cases.

Report issue for preceding element

### 3.2 Image2Image

Report issue for preceding element

The image-to-image generation task takes an image as a prompt and generates a new image based on it. Sprite sheet generation can be treated as a downstream task for image generation, which requires creating consistent motion images based on a given character’s image and pose. The diffusion-based generative model (Rombach et al., [2022](https://arxiv.org/html/2412.03685v1#bib.bib7 "")) is widely considered the state-of-the-art for many image generation tasks (Dhariwal and Nichol, [2021](https://arxiv.org/html/2412.03685v1#bib.bib3 ""); Yang et al., [2023](https://arxiv.org/html/2412.03685v1#bib.bib12 "")). Additionally, numerous previous works have focused on controlling the image generation process. For instance, Zhang et al. ( [2023](https://arxiv.org/html/2412.03685v1#bib.bib14 "")) propose ControlNet, which can be applied to large pretrained diffusion models to introduce a conditional image that guides the spatial structure of the generated image. Similarly, IPAdaptor, presented by Ye et al. ( [2023](https://arxiv.org/html/2412.03685v1#bib.bib13 "")), serves as a lightweight adapter to the diffusion model, assisting in generating images that are similar to the reference images in content and style. However, although these methods help add control to image generation tasks, when generating a sequence of images for a specific character, diffusion-based generation models still suffer from inconsistencies in character portrayal. This limitation has become a bottleneck in applying diffusion models to real-world applications, such as game development.

Report issue for preceding element

### 3.3 Image2Video

Report issue for preceding element

Pose-to-video synthesis aims to generate realistic and temporally coherent video sequences from a sequence of human poses. This task is crucial for applications in animation, virtual reality, and game development, where smooth and consistent character movements are essential. Building upon the foundations of image-to-image and image-to-pose techniques discussed in the previous subsections, pose-to-video methods integrate pose information to create dynamic and controllable animations.

Report issue for preceding element

In the context of our project, the methodologies from Hu ( [2024](https://arxiv.org/html/2412.03685v1#bib.bib5 "")); Wei et al. ( [2024](https://arxiv.org/html/2412.03685v1#bib.bib11 "")) are particularly relevant. Hu ( [2024](https://arxiv.org/html/2412.03685v1#bib.bib5 "")) introduces a diffusion-based framework for character animation that leverages ReferenceNet with spatial attention to merge appearance features from a reference image and incorporates a pose guider alongside temporal modeling to ensure smooth inter-frame transitions. Building upon this foundation, Wei et al. ( [2024](https://arxiv.org/html/2412.03685v1#bib.bib11 "")) present AniPortrait, which specializes in facial animation by integrating audio inputs with reference portrait images.

Report issue for preceding element

In contrast to these video-focused approaches, our work adapts pose-to-video techniques to generate discrete animation frames tailored for game engines such as Unity. By utilizing pose conditioning and diffusion models, we ensure that each sprite maintains character consistency and exhibits smooth transitions between poses. This adaptation addresses the unique requirements of game development, enabling the creation of frame-by-frame animations that integrate seamlessly into interactive environments.

Report issue for preceding element

## 4 Approach

Report issue for preceding element

In this work, we adapt the framework proposed by Wei et al. ( [2024](https://arxiv.org/html/2412.03685v1#bib.bib11 "")) for the novel application of generating sprite sheets tailored for game character animation. The pipeline of our method is illustrated in Figure [3](https://arxiv.org/html/2412.03685v1#A3.F3 "Figure 3 ‣ Appendix C Framework ‣ Sprite Sheet Diffusion: Generate Game Character for Animation"). The methodology comprises three key components: ReferenceNet, Pose Guider, and Motion Module. ReferenceNet encodes the appearance features of the character from a reference image by leveraging a SD-v1.5 model with modified self-attention layers replaced by spatial-attention layers. Cross-attention, driven by a CLIP image encoder, enhances feature integration between ReferenceNet and denoising net. The Pose Guider encodes motion information using four convolution layers to align the pose image with the same resolution as the noise latent. The processed pose image is then added to the noisy latent before being input to the denoising net. To ensure temporal continuity, the Motion Module is embedded in the Res-Trans block, following spatial- and cross- attention layers, effectively modeling smooth transitions between animation frames.

Report issue for preceding element

### 4.1 Training Procedure

Report issue for preceding element

The training is conducted in two stages to optimize pose conditioning and temporal consistency. In stage 1 (Pose-to-Image), ReferenceNet, the denoising network, and Pose Guider are trained to generate individual character images based on input poses. ReferenceNet encodes the reference image, while Pose Guider encodes pose information. These features are integrated by the denoising network to ensure accurate appearance and pose representation. In stage 2 (Pose-to-Sprite), the Motion Module is trained for temporal consistency, with the weights of ReferenceNet, the denoising network, and Pose Guider frozen from stage 1. This stage focuses on smooth and coherent transitions across animation frames.

Report issue for preceding element

### 4.2 Baseline and Comparison

Report issue for preceding element

#### 4.2.1 Stable Diffusion with ControlNet and IPAdaptor Integration (SD-IPCN)

Report issue for preceding element

For the first baseline, we employ a method that treats sequential image generation as an image-to-image generation problem, leveraging pose and character images as prompts to guide the process. We follow IPAdaptor (Ye et al., [2023](https://arxiv.org/html/2412.03685v1#bib.bib13 ""))’s method to integrate SD-v1.5 (Rombach et al., [2022](https://arxiv.org/html/2412.03685v1#bib.bib7 "")) with ControlNet (Zhang et al., [2023](https://arxiv.org/html/2412.03685v1#bib.bib14 "")) and IPAdaptor (Ye et al., [2023](https://arxiv.org/html/2412.03685v1#bib.bib13 "")). To improve frame-to-frame consistency of this baseline, we generate all frames of an action sequence as a single concatenated image.

Report issue for preceding element

#### 4.2.2 AnimateAnyone

Report issue for preceding element

For our second baseline, which is also the main method we advocate in the midway report, we refer to AnimateAnyone, the framework of Hu ( [2024](https://arxiv.org/html/2412.03685v1#bib.bib5 "")) that focuses on general character animation. Unlike Hu ( [2024](https://arxiv.org/html/2412.03685v1#bib.bib5 "")), which generates continuous video sequences, our approach modifies this framework to address sequential image generation as a video generation problem. By adapting the training process and network architecture, we aim to produce discrete sprite frames with high visual fidelity and temporal smoothness. This adjustment ensures the frames are suitable for integration into game engines, preserving both artistic quality and consistency between frames. We further fine-tune AnimateAnyone on our training set in the experiment section.

Report issue for preceding element

## 5 Experiments

Report issue for preceding element

We ran the two baselines and also performed finetuning for AnimateAnyone. We report the results of the test set on evaluation criteria described in Section [2](https://arxiv.org/html/2412.03685v1#S2 "2 Dataset and Task ‣ Sprite Sheet Diffusion: Generate Game Character for Animation") to assess the quality of the generated images as well as the subject consistency.

Report issue for preceding element

Up to the Midway Report deadline, we have conducted experiments on the dataset we created so far. For the AnimateAnyone fine-tuned model, we ran stage 1 training on an NVIDIA L40S for 10 hours and stage 2 training on an NVIDIA 4090 GPU for 2 hours. For inference, both with the pretrained AnimateAnyone model and the fine-tuned version, we used the NVIDIA 4090. For running the SD-IPCN pipeline, we used an NVIDIA A10G.

Report issue for preceding element

Table [1](https://arxiv.org/html/2412.03685v1#S5.T1 "Table 1 ‣ 5 Experiments ‣ Sprite Sheet Diffusion: Generate Game Character for Animation") presents a quantitative comparison between our main method and baseline approaches. The results demonstrate that our method exhibits superior performance, particularly in its ability to align with reference images, which highlights the effectiveness of our approach in maintaining fidelity to the reference images. In terms of the SSIM score, the AnimateAnyone method outperforms SD-IPCN, indicating that adapting video generation techniques to the task of sequential image generation is beneficial for preserving structural consistency with the provided main character image. Although both our approach and SD-IPCN yield comparable results in subject consistency across motion frames, our method did not meet expectations for achieving a higher subject consistency score. We suspect this limitation arises from potential overfitting during the fine-tuning process, likely caused by the small dataset size and limited diversity of characters.

Report issue for preceding element

|  | SSIM↑↑\\uparrow↑ | PSNR↑↑\\uparrow↑ | LPIPS↓↓\\downarrow↓ | Subject Consistency↑↑\\uparrow↑ |
| --- | --- | --- | --- | --- |
| AnimateAnyone (Finetuned) | 0.721 ± 0.159 | 15.662 ± 2.685 | 0.176 ± 0.110 | 0.904 ± 0.061 |
| AnimateAnyone | 0.382 ± 0.196 | 9.894 ± 3.459 | 0.544 ± 0.206 | \- 222Because AnimateAnyone without fine-tuning struggles to follow the given pose image and generate diverse actions across different frames, the frames show minimal variation. Therefore, we did not evaluate the subject consistency for this method, as it is not meaningful in this case. |
| SD-IPCN | 0.301 ± 0.079 | 10.314 ± 1.253 | 0.372 ± 0.088 | 0.903 ± 0.042 |

Table 1: Quantitative Comparison.Report issue for preceding element

For this midway checkpoint, we also sampled two sets of motion frames to qualitatively evaluate our method. Both Figure [4](https://arxiv.org/html/2412.03685v1#A4.F4 "Figure 4 ‣ Appendix D Qualitative Comparison ‣ Sprite Sheet Diffusion: Generate Game Character for Animation") and Figure [5](https://arxiv.org/html/2412.03685v1#A4.F5 "Figure 5 ‣ Appendix D Qualitative Comparison ‣ Sprite Sheet Diffusion: Generate Game Character for Animation") show that our method performs better than other methods in both image quality and alignment with the given main character image. However, Figure [5](https://arxiv.org/html/2412.03685v1#A4.F5 "Figure 5 ‣ Appendix D Qualitative Comparison ‣ Sprite Sheet Diffusion: Generate Game Character for Animation") reveals overfitting issues since the generated characters include some robot-like features, which appear in our training set.

Report issue for preceding element

## 6 Plan

Report issue for preceding element

Based on our current results, our team will focus on the following aspects before the final deadline:

Report issue for preceding element

1. 1.


Dataset Creation (Due: 11/30, Assigned: Cheng-An, Ava, Jing)


Continue creating the dataset to increase both its size and the diversity of characters to address overfitting issues.

Report issue for preceding element

2. 2.


Fine-Tuning Analysis (Due: 12/08, Assigned: Cheng-An, Jing)


Analyze approaches to improve the current fine-tuning framework to enhance the performance of our main method.

Report issue for preceding element

3. 3.


Exploring Alternative Methods (Due: 12/08, Assigned: Ava)


Based on Henry’s advice to try different methods as a potential backup plan, we will investigate fine-tuning SD with IPAdaptor and ControlNet to improve alignment with the given main character image.

Report issue for preceding element

4. 4.


Final Executive Summary & Poster (Due: 12/11, Assigned: Cheng-An, Ava, Jing)

Report issue for preceding element


## References

Report issue for preceding element

- Cao et al. \[2017\]↑
Zhe Cao, Tomas Simon, Shih-En Wei, and Yaser Sheikh.

Realtime multi-person 2d pose estimation using part affinity fields.

In _Proceedings of the IEEE Conference on Computer Vision and Pattern Recognition (CVPR)_, pages 7291–7299, 2017.

- Chen and Zwicker \[2022\]↑
Shuhong Chen and Matthias Zwicker.

Transfer learning for pose estimation of illustrated characters.

In _Proceedings of the IEEE/CVF Winter Conference on Applications of Computer Vision_, 2022.

- Dhariwal and Nichol \[2021\]↑
Prafulla Dhariwal and Alexander Nichol.

Diffusion models beat gans on image synthesis.

_Advances in neural information processing systems_, 34:8780–8794, 2021.

- Horé and Ziou \[2010\]↑
Alain Horé and Djemel Ziou.

Image quality metrics: Psnr vs. ssim.

In _2010 20th International Conference on Pattern Recognition_, pages 2366–2369, 2010.

doi: 10.1109/ICPR.2010.579.

- Hu \[2024\]↑
Li Hu.

Animate anyone: Consistent and controllable image-to-video synthesis for character animation.

In _Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition_, pages 8153–8163, 2024.

- Huang et al. \[2024\]↑
Ziqi Huang, Yinan He, Jiashuo Yu, Fan Zhang, Chenyang Si, Yuming Jiang, Yuanhan Zhang, Tianxing Wu, Qingyang Jin, Nattapol Chanpaisit, et al.

Vbench: Comprehensive benchmark suite for video generative models.

In _Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition_, pages 21807–21818, 2024.

- Rombach et al. \[2022\]↑
Robin Rombach, Andreas Blattmann, Dominik Lorenz, Patrick Esser, and Björn Ommer.

High-resolution image synthesis with latent diffusion models.

In _Proceedings of the IEEE/CVF conference on computer vision and pattern recognition_, pages 10684–10695, 2022.

- Tian et al. \[2021\]↑
Yuliang Tian, Xu Li, Weixin Wang, and Lianwen Zhang.

Dw-pose: Deep whole-body pose estimation with dense regression.

_Proceedings of the IEEE/CVF International Conference on Computer Vision (ICCV)_, pages 11808–11817, 2021.

- Toshev and Szegedy \[2014\]↑
Alexander Toshev and Christian Szegedy.

Deeppose: Human pose estimation via deep neural networks.

In _Proceedings of the IEEE Conference on Computer Vision and Pattern Recognition (CVPR)_, pages 1653–1660, 2014.

- Wang et al. \[2004\]↑
Zhou Wang, A.C. Bovik, H.R. Sheikh, and E.P. Simoncelli.

Image quality assessment: from error visibility to structural similarity.

_IEEE Transactions on Image Processing_, 13(4):600–612, 2004.

doi: 10.1109/TIP.2003.819861.

- Wei et al. \[2024\]↑
Huawei Wei, Zejun Yang, and Zhisheng Wang.

Aniportrait: Audio-driven synthesis of photorealistic portrait animation.

_arXiv preprint arXiv:2403.17694_, 2024.

- Yang et al. \[2023\]↑
Ling Yang, Zhilong Zhang, Yang Song, Shenda Hong, Runsheng Xu, Yue Zhao, Wentao Zhang, Bin Cui, and Ming-Hsuan Yang.

Diffusion models: A comprehensive survey of methods and applications.

_ACM Computing Surveys_, 56(4):1–39, 2023.

- Ye et al. \[2023\]↑
Hu Ye, Jun Zhang, Sibo Liu, Xiao Han, and Wei Yang.

Ip-adapter: Text compatible image prompt adapter for text-to-image diffusion models.

_arXiv preprint arXiv:2308.06721_, 2023.

- Zhang et al. \[2023\]↑
Lvmin Zhang, Anyi Rao, and Maneesh Agrawala.

Adding conditional control to text-to-image diffusion models.

In _Proceedings of the IEEE/CVF International Conference on Computer Vision_, pages 3836–3847, 2023.

- Zhang et al. \[2018\]↑
Richard Zhang, Phillip Isola, Alexei A Efros, Eli Shechtman, and Oliver Wang.

The unreasonable effectiveness of deep features as a perceptual metric.

In _Proceedings of the IEEE conference on computer vision and pattern recognition_, pages 586–595, 2018.

- Zheng et al. \[2023\]↑
Cheng Zheng, Wenbing Wu, Chen Chen, Tong Yang, Siyu Zhu, Jianbing Shen, and Mubarak Shah.

Deep learning-based human pose estimation: A survey.

_ACM Computing Surveys_, 56(1):1–37, 2023.


## Appendix A Visual Illustration

Report issue for preceding element

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/WechatIMG165.jpg)

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/WechatIMG166.jpg)

Figure 1: A sprite in game development is a 2D bitmap graphic representing a character, object, or visual element. A sprite sheet is a single image file containing multiple sprites. The left image shows three game character sprites, while the right displays the sprite sheet of one character’s action sequences. Image source: [https://craftpix.net/product/pixel-art-characters-for-platformer-games/.](https://craftpix.net/product/pixel-art-characters-for-platformer-games/ "")Report issue for preceding element

## Appendix B Dataset

Report issue for preceding element

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/dataset/ref.png)(a)Reference ImageReport issue for preceding element

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/dataset/humanpose_1.png)

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/dataset/humanpose_2.png)

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/dataset/humanpose_3.png)

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/dataset/humanpose_4.png)

(b)Pose SequenceReport issue for preceding element

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/dataset/frame_1.png)

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/dataset/frame_2.png)

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/dataset/frame_3.png)

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/dataset/frame_4.png)

(c)Action SequenceReport issue for preceding element

Figure 2: An example of an action sequence for one character.Report issue for preceding element

## Appendix C Framework

Report issue for preceding element![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/method.png)Figure 3: FrameworkReport issue for preceding element

## Appendix D Qualitative Comparison

Report issue for preceding element

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/results/qa-groundtruth-1.png)

Reference Image

Report issue for preceding element

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/results/qa-baseline-1.png)

AnimateAnyone

Report issue for preceding element

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/results/qa-ipadaptor-1.png)

SD w/ IPAdaptor and ControlNet

Report issue for preceding element

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/results/qa-finetune-1.png)

Ours

Report issue for preceding element

Figure 4: Qualitative Comparison (Adventure Girl - Jump)Report issue for preceding element

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/results/qa-groundtruth-2.png)

Reference Image

Report issue for preceding element

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/results/qa-baseline-2.png)

AnimateAnyone

Report issue for preceding element

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/results/qa-ipadaptor-2.png)

SD w/ IPAdaptor and ControlNet

Report issue for preceding element

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/results/qa-finetune-2.png)

Ours

Report issue for preceding element

Figure 5: Qualitative Comparison (Cute Girl - Dead)Report issue for preceding element

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/placeholder.png)

Reference Image

Report issue for preceding element

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/placeholder.png)

AnimateAnyone

Report issue for preceding element

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/placeholder.png)

SD w/ IPAdaptor and ControlNet

Report issue for preceding element

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/placeholder.png)

Ours

Report issue for preceding element

Figure 6: Qualitative Comparison - PlaceholderReport issue for preceding element

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/placeholder.png)

Reference Image

Report issue for preceding element

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/placeholder.png)

AnimateAnyone

Report issue for preceding element

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/placeholder.png)

SD w/ IPAdaptor and ControlNet

Report issue for preceding element

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/placeholder.png)

Ours

Report issue for preceding element

Figure 7: Qualitative Comparison - PlaceholderReport issue for preceding element

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/placeholder.png)

Reference Image

Report issue for preceding element

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/placeholder.png)

AnimateAnyone

Report issue for preceding element

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/placeholder.png)

SD w/ IPAdaptor and ControlNet

Report issue for preceding element

![Refer to caption](https://arxiv.org/html/2412.03685v1/extracted/6046004/placeholder.png)

Ours

Report issue for preceding element

Figure 8: Qualitative Comparison - PlaceholderReport issue for preceding element

Report Issue

##### Report GitHub Issue

Title:

Content selection saved. Describe the issue below:

Description:

Submit without GitHubSubmit in GitHub

Report Issue for Selection

Generated by
[L\\
A\\
T\\
Exml![[LOGO]](<Base64-Image-Removed>)](https://math.nist.gov/~BMiller/LaTeXML/)

## Instructions for reporting errors

We are continuing to improve HTML versions of papers, and your feedback helps enhance accessibility and mobile support. To report errors in the HTML that will help us improve conversion and rendering, choose any of the methods listed below:

- Click the "Report Issue" button.
- Open a report feedback form via keyboard, use " **Ctrl + ?**".
- Make a text selection and click the "Report Issue for Selection" button near your cursor.
- You can use Alt+Y to toggle on and Alt+Shift+Y to toggle off accessible reporting links at each section.

Our team has already identified [the following issues](https://github.com/arXiv/html_feedback/issues). We appreciate your time reviewing and reporting rendering errors we may not have found yet. Your efforts will help us improve the HTML versions for all readers, because disability should not be a barrier to accessing research. Thank you for your continued support in championing open access for all.

Have a free development cycle? Help support accessibility at arXiv! Our collaborators at LaTeXML maintain a [list of packages that need conversion](https://github.com/brucemiller/LaTeXML/wiki/Porting-LaTeX-packages-for-LaTeXML), and welcome [developer contributions](https://github.com/brucemiller/LaTeXML/issues).