# Fine-tuning Guide - Knowledge Distillation and LoRA

This guide covers fine-tuning strategies for OCR and Document Understanding models.

## Overview

We support two main fine-tuning approaches:

1. **Knowledge Distillation**: Create smaller, faster models from large teacher models
2. **LoRA (Low-Rank Adaptation)**: Parameter-efficient fine-tuning for domain adaptation

## Knowledge Distillation

### Concept

Knowledge Distillation transfers knowledge from a large teacher model to a smaller student model:

```
Teacher Model (Large) → Student Model (Small)
    ↓                       ↓
  High Accuracy          Fast Inference
  Slow Inference         Lower Memory
```

### OCR Model Distillation

#### Teacher Model

Large OCR model for high accuracy:
- TrOCR-Large
- PaddleOCR-Server
- Google Cloud Vision API (reference)

#### Student Model

Lightweight model for fast inference:
- TrOCR-Small
- TrOCR-Base
- MobileOCR

#### Training Process

```python
# src/training/ocr_model/distill_student.py

from transformers import AutoModel, AutoTokenizer
import torch
import torch.nn as nn

class DistillationLoss(nn.Module):
    def __init__(self, temperature=5.0, alpha=0.5):
        super().__init__()
        self.temperature = temperature
        self.alpha = alpha
        self.kl_div = nn.KLDivLoss(reduction='batchmean')
        self.ce_loss = nn.CrossEntropyLoss()
    
    def forward(self, student_logits, teacher_logits, labels):
        # Soft targets from teacher
        teacher_probs = torch.softmax(teacher_logits / self.temperature, dim=-1)
        student_log_probs = torch.log_softmax(student_logits / self.temperature, dim=-1)
        
        # Distillation loss
        distillation_loss = self.kl_div(student_log_probs, teacher_probs) * (self.temperature ** 2)
        
        # Hard targets loss
        hard_loss = self.ce_loss(student_logits, labels)
        
        # Combined loss
        total_loss = self.alpha * distillation_loss + (1 - self.alpha) * hard_loss
        
        return total_loss

# Training loop
def train_student():
    teacher = AutoModel.from_pretrained("microsoft/trocr-large-printed")
    student = AutoModel.from_pretrained("microsoft/trocr-small-printed")
    
    teacher.eval()  # Teacher in eval mode
    student.train()  # Student in train mode
    
    criterion = DistillationLoss(temperature=5.0, alpha=0.5)
    optimizer = torch.optim.AdamW(student.parameters(), lr=5e-5)
    
    for epoch in range(num_epochs):
        for batch in dataloader:
            # Forward pass
            teacher_outputs = teacher(**batch)
            student_outputs = student(**batch)
            
            # Compute loss
            loss = criterion(
                student_outputs.logits,
                teacher_outputs.logits,
                batch['labels']
            )
            
            # Backward pass
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
```

#### Training Command

```bash
python src/training/ocr_model/distill_student.py \
    --teacher_model microsoft/trocr-large-printed \
    --student_model microsoft/trocr-small-printed \
    --dataset_path data/training/timetables \
    --output_dir models/ocr_student \
    --temperature 5.0 \
    --alpha 0.5 \
    --epochs 10 \
    --batch_size 16 \
    --learning_rate 5e-5
```

### Document Model Distillation

For document understanding models, distill from Claude API or large LLM:

```python
# Use Claude API as teacher
teacher_responses = []
for example in training_data:
    response = claude_api.extract_timetable(example.image)
    teacher_responses.append(response)

# Train student model on teacher outputs
train_student_on_responses(teacher_responses, training_data)
```

## LoRA Fine-tuning

### Concept

LoRA (Low-Rank Adaptation) adds small trainable matrices to model weights:

```
Original Weight: W (d x d)
LoRA Adaptation: W + ΔW = W + BA
                  where B (d x r), A (r x d), r << d
```

### OCR Model LoRA

#### Setup

```python
# src/training/ocr_model/lora_finetune.py

from peft import LoraConfig, get_peft_model, TaskType
from transformers import AutoModel

# Load base model
model = AutoModel.from_pretrained("microsoft/trocr-base-printed")

# Configure LoRA
lora_config = LoraConfig(
    task_type=TaskType.IMAGE_TO_TEXT,
    r=16,  # Rank
    lora_alpha=32,  # Scaling factor
    target_modules=["query", "key", "value"],  # Which layers to adapt
    lora_dropout=0.1
)

# Apply LoRA
model = get_peft_model(model, lora_config)

# Train (only LoRA parameters are updated)
for epoch in range(num_epochs):
    for batch in dataloader:
        outputs = model(**batch)
        loss = compute_loss(outputs, batch['labels'])
        loss.backward()
        optimizer.step()
```

#### Training Command

```bash
python src/training/ocr_model/lora_finetune.py \
    --model_name microsoft/trocr-base-printed \
    --dataset_path data/training/timetables \
    --output_dir models/ocr_lora \
    --rank 16 \
    --alpha 32 \
    --target_modules query key value \
    --epochs 5 \
    --batch_size 8 \
    --learning_rate 3e-4
```

### Document Model LoRA

#### For LLM-based Models

```python
# src/training/document_model/lora_finetune.py

from peft import LoraConfig, get_peft_model
from transformers import AutoModelForCausalLM

# Load base model (e.g., Llama 3, Mistral)
model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3-8B")

# Configure LoRA for LLM
lora_config = LoraConfig(
    task_type=TaskType.CAUSAL_LM,
    r=32,
    lora_alpha=64,
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
    lora_dropout=0.1
)

# Apply LoRA
model = get_peft_model(model, lora_config)

# Training with instruction tuning format
def format_prompt(image, timetable_data):
    return f"""Extract timetable data from this image.
    
Image: {image}
Output: {timetable_data}
"""
```

#### Training Command

```bash
python src/training/document_model/lora_finetune.py \
    --model_name meta-llama/Llama-3-8B \
    --dataset_path data/training/timetables_annotated \
    --output_dir models/document_lora \
    --rank 32 \
    --alpha 64 \
    --epochs 3 \
    --batch_size 4 \
    --learning_rate 2e-4
```

## Training Data Requirements

### OCR Training Data

**Format**: Images with text annotations

```
data/training/timetables/
├── images/
│   ├── timetable_001.png
│   ├── timetable_002.png
│   └── ...
└── annotations/
    ├── timetable_001.txt  # Ground truth text
    ├── timetable_002.txt
    └── ...
```

**Minimum Requirements**:
- 1000+ images for fine-tuning
- 5000+ images for distillation
- Diverse layouts and formats
- Various image qualities

### Document Training Data

**Format**: Images with structured JSON annotations

```json
{
  "image_path": "timetable_001.png",
  "teacher": "Mr. Smith",
  "className": "Grade 5",
  "term": "Term 1",
  "year": 2024,
  "timeblocks": [
    {
      "day": "Monday",
      "name": "Mathematics",
      "startTime": "09:00",
      "endTime": "10:00"
    }
  ]
}
```

**Minimum Requirements**:
- 500+ annotated examples
- Diverse timetable formats
- Various layouts and styles

## Hyperparameter Tuning

### Distillation Hyperparameters

- **Temperature**: Higher (5-10) for softer probabilities
- **Alpha**: Balance between distillation and hard loss (0.3-0.7)
- **Learning Rate**: Typically 5e-5 to 1e-4

### LoRA Hyperparameters

- **Rank (r)**: 8-64, higher for more capacity
- **Alpha**: Usually 2x rank for scaling
- **Target Modules**: Key layers to adapt
- **Dropout**: 0.05-0.2 for regularization

### Learning Rate Schedule

```python
from transformers import get_cosine_schedule_with_warmup

scheduler = get_cosine_schedule_with_warmup(
    optimizer,
    num_warmup_steps=100,
    num_training_steps=num_epochs * len(dataloader)
)
```

## Model Evaluation

### Metrics

```python
from src.training.evaluation import ModelEvaluator

evaluator = ModelEvaluator()

metrics = evaluator.evaluate(
    model=model,
    test_dataset=test_data,
    metrics=["accuracy", "cer", "wer", "inference_time"]
)

print(f"Character Error Rate: {metrics['cer']:.2%}")
print(f"Word Error Rate: {metrics['wer']:.2%}")
print(f"Inference Time: {metrics['inference_time']:.3f}s")
```

### Comparison with Baseline

```python
baseline_metrics = evaluator.evaluate(baseline_model, test_data)
fine_tuned_metrics = evaluator.evaluate(fine_tuned_model, test_data)

improvement = {
    metric: fine_tuned_metrics[metric] - baseline_metrics[metric]
    for metric in baseline_metrics
}

print(f"Improvement: {improvement}")
```

## Best Practices

1. **Start Small**: Begin with LoRA before full fine-tuning
2. **Validate Early**: Check validation metrics frequently
3. **Save Checkpoints**: Save model at each epoch
4. **Monitor Overfitting**: Track train vs validation loss
5. **Experiment Tracking**: Log all hyperparameters in MLflow
6. **Data Augmentation**: Augment training data for robustness

## Troubleshooting

### Overfitting

- Increase dropout
- Reduce LoRA rank
- Add data augmentation
- Early stopping

### Underfitting

- Increase LoRA rank
- More training epochs
- Increase learning rate
- Check data quality

### Slow Training

- Use mixed precision training
- Reduce batch size
- Gradient accumulation
- Distributed training

---

**Document Version**: 1.0.0  
**Last Updated**: 2025-01-01

