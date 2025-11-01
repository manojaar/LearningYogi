"""
LoRA Fine-tuning for Document Understanding Models.

This script fine-tunes LLM-based document understanding models
using LoRA for efficient parameter-efficient fine-tuning.
"""

import argparse
import torch
from torch.utils.data import DataLoader
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer
)
from peft import LoraConfig, get_peft_model, TaskType
from pathlib import Path

from src.mlops.mlflow_tracking import MLflowTracker


class LoRADocumentTrainer:
    """Trainer for LoRA fine-tuning of document understanding models"""
    
    def __init__(self, model_name, output_dir, device, rank, alpha, target_modules):
        self.device = device
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Load base model and tokenizer
        print(f"Loading model: {model_name}")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        
        # Add padding token if not present
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        
        self.base_model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16 if device.type == 'cuda' else torch.float32,
            device_map="auto" if device.type == 'cuda' else None
        )
        
        # Configure LoRA
        lora_config = LoraConfig(
            task_type=TaskType.CAUSAL_LM,
            r=rank,
            lora_alpha=alpha,
            target_modules=target_modules,
            lora_dropout=0.1,
            bias="none"
        )
        
        # Apply LoRA
        self.model = get_peft_model(self.base_model, lora_config)
        self.model.print_trainable_parameters()
        
        print("LoRA configuration applied")
    
    def format_prompt(self, image_description, timetable_data):
        """Format prompt for instruction tuning"""
        prompt = f"""Extract timetable data from this document.

Document Description: {image_description}

Extract and return a JSON object with this structure:
{{
  "teacher": "Teacher name",
  "className": "Class name",
  "term": "Term/semester",
  "year": 2024,
  "timeblocks": [
    {{
      "day": "Monday",
      "name": "Subject name",
      "startTime": "HH:MM",
      "endTime": "HH:MM"
    }}
  ]
}}

Extracted Data:
{{
  "teacher": "{timetable_data.get('teacher', '')}",
  "className": "{timetable_data.get('className', '')}",
  "term": "{timetable_data.get('term', '')}",
  "year": {timetable_data.get('year', 2024)},
  "timeblocks": {timetable_data.get('timeblocks', [])}
}}
"""
        return prompt
    
    def train(self, train_dataset, val_dataset, epochs, learning_rate, batch_size):
        """Train model with LoRA"""
        
        # Training arguments
        training_args = TrainingArguments(
            output_dir=str(self.output_dir),
            num_train_epochs=epochs,
            per_device_train_batch_size=batch_size,
            per_device_eval_batch_size=batch_size,
            learning_rate=learning_rate,
            fp16=torch.cuda.is_available(),
            logging_steps=100,
            eval_strategy="epoch",
            save_strategy="epoch",
            load_best_model_at_end=True,
            metric_for_best_model="eval_loss",
            greater_is_better=False,
            save_total_limit=3,
        )
        
        # Create trainer
        trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=train_dataset,
            eval_dataset=val_dataset,
            tokenizer=self.tokenizer,
        )
        
        # Train
        trainer.train()
        
        # Save final model
        self.save_model()
        
        print("Training complete!")
    
    def save_model(self):
        """Save LoRA model"""
        save_path = self.output_dir / "final"
        save_path.mkdir(exist_ok=True)
        
        # Save LoRA adapters
        self.model.save_pretrained(save_path)
        self.tokenizer.save_pretrained(save_path)
        
        print(f"Model saved to {save_path}")


def create_dataset(dataset_path, tokenizer, max_length=512):
    """Create dataset from annotations"""
    # TODO: Implement dataset loading
    from torch.utils.data import Dataset
    
    class DocumentDataset(Dataset):
        def __init__(self, data, tokenizer, max_length):
            self.data = data
            self.tokenizer = tokenizer
            self.max_length = max_length
        
        def __len__(self):
            return len(self.data)
        
        def __getitem__(self, idx):
            item = self.data[idx]
            prompt = item['prompt']
            
            # Tokenize
            encoded = self.tokenizer(
                prompt,
                max_length=self.max_length,
                padding='max_length',
                truncation=True,
                return_tensors='pt'
            )
            
            # Labels are same as input_ids for causal LM
            encoded['labels'] = encoded['input_ids'].clone()
            
            return {
                'input_ids': encoded['input_ids'].squeeze(),
                'attention_mask': encoded['attention_mask'].squeeze(),
                'labels': encoded['labels'].squeeze()
            }
    
    # Placeholder - implement based on your data format
    dataset = DocumentDataset([], tokenizer, max_length)
    return dataset


def main():
    parser = argparse.ArgumentParser(description='LoRA Fine-tuning for Document Models')
    parser.add_argument('--model_name', type=str, default='meta-llama/Llama-3-8B',
                       help='Base model name')
    parser.add_argument('--dataset_path', type=str, required=True,
                       help='Path to training dataset')
    parser.add_argument('--output_dir', type=str, default='models/document_lora',
                       help='Output directory')
    parser.add_argument('--rank', type=int, default=32,
                       help='LoRA rank')
    parser.add_argument('--alpha', type=int, default=64,
                       help='LoRA alpha')
    parser.add_argument('--target_modules', nargs='+',
                       default=['q_proj', 'v_proj', 'k_proj', 'o_proj'],
                       help='Target modules for LoRA')
    parser.add_argument('--epochs', type=int, default=3,
                       help='Number of epochs')
    parser.add_argument('--batch_size', type=int, default=4,
                       help='Batch size')
    parser.add_argument('--learning_rate', type=float, default=2e-4,
                       help='Learning rate')
    
    args = parser.parse_args()
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    # MLflow tracking
    tracker = MLflowTracker()
    with tracker.start_run(run_name="document_lora"):
        tracker.log_params({
            'model_name': args.model_name,
            'rank': args.rank,
            'alpha': args.alpha,
            'target_modules': args.target_modules,
            'epochs': args.epochs
        })
        
        # Initialize trainer
        trainer = LoRADocumentTrainer(
            model_name=args.model_name,
            output_dir=args.output_dir,
            device=device,
            rank=args.rank,
            alpha=args.alpha,
            target_modules=args.target_modules
        )
        
        # Create datasets
        train_dataset = create_dataset(
            args.dataset_path,
            trainer.tokenizer,
            max_length=512
        )
        
        val_dataset = create_dataset(
            args.dataset_path,
            trainer.tokenizer,
            max_length=512
        )
        
        # Train
        trainer.train(
            train_dataset=train_dataset,
            val_dataset=val_dataset,
            epochs=args.epochs,
            learning_rate=args.learning_rate,
            batch_size=args.batch_size
        )
        
        print("LoRA fine-tuning complete!")


if __name__ == '__main__':
    main()

