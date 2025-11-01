"""
LoRA Fine-tuning for OCR models.

This script fine-tunes OCR models using LoRA (Low-Rank Adaptation)
for efficient parameter-efficient fine-tuning.
"""

import argparse
import torch
from torch.utils.data import DataLoader
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from transformers import AdamW, get_cosine_schedule_with_warmup
from peft import LoraConfig, get_peft_model, TaskType
from pathlib import Path

from src.mlops.mlflow_tracking import MLflowTracker


class LoRAOCRTrainer:
    """Trainer for LoRA fine-tuning of OCR models"""
    
    def __init__(self, model_name, output_dir, device, rank, alpha, target_modules):
        self.device = device
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Load base model
        print(f"Loading model: {model_name}")
        self.processor = TrOCRProcessor.from_pretrained(model_name)
        self.base_model = VisionEncoderDecoderModel.from_pretrained(model_name)
        
        # Configure LoRA
        lora_config = LoraConfig(
            task_type=TaskType.IMAGE_TO_TEXT,
            r=rank,
            lora_alpha=alpha,
            target_modules=target_modules,
            lora_dropout=0.1,
            bias="none"
        )
        
        # Apply LoRA
        self.model = get_peft_model(self.base_model, lora_config)
        self.model.print_trainable_parameters()
        self.model.to(device)
        
        print("LoRA configuration applied")
    
    def train(self, train_dataloader, val_dataloader, epochs, learning_rate):
        """Train model with LoRA"""
        
        # Setup optimizer (only trainable parameters)
        optimizer = AdamW(self.model.parameters(), lr=learning_rate)
        total_steps = len(train_dataloader) * epochs
        scheduler = get_cosine_schedule_with_warmup(
            optimizer,
            num_warmup_steps=int(0.1 * total_steps),
            num_training_steps=total_steps
        )
        
        best_val_loss = float('inf')
        
        for epoch in range(epochs):
            self.model.train()
            train_loss = 0.0
            
            for batch_idx, batch in enumerate(train_dataloader):
                pixel_values = batch['pixel_values'].to(self.device)
                labels = batch['labels'].to(self.device)
                
                # Forward pass
                outputs = self.model(
                    pixel_values=pixel_values,
                    labels=labels
                )
                
                loss = outputs.loss
                
                # Backward pass
                optimizer.zero_grad()
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
                optimizer.step()
                scheduler.step()
                
                train_loss += loss.item()
                
                if batch_idx % 100 == 0:
                    print(f"Epoch {epoch+1}/{epochs}, Batch {batch_idx}, Loss: {loss.item():.4f}")
            
            # Validation
            val_loss = self.validate(val_dataloader)
            avg_train_loss = train_loss / len(train_dataloader)
            
            print(f"Epoch {epoch+1}/{epochs}")
            print(f"  Train Loss: {avg_train_loss:.4f}")
            print(f"  Val Loss: {val_loss:.4f}")
            
            # Save best model
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                self.save_model(f"epoch_{epoch+1}")
        
        print(f"Training complete. Best validation loss: {best_val_loss:.4f}")
    
    def validate(self, val_dataloader):
        """Validate the model"""
        self.model.eval()
        total_loss = 0.0
        
        with torch.no_grad():
            for batch in val_dataloader:
                pixel_values = batch['pixel_values'].to(self.device)
                labels = batch['labels'].to(self.device)
                
                outputs = self.model(
                    pixel_values=pixel_values,
                    labels=labels
                )
                
                total_loss += outputs.loss.item()
        
        return total_loss / len(val_dataloader)
    
    def save_model(self, name):
        """Save LoRA model"""
        save_path = self.output_dir / name
        save_path.mkdir(exist_ok=True)
        
        # Save LoRA adapters and base model config
        self.model.save_pretrained(save_path)
        self.processor.save_pretrained(save_path)
        
        print(f"Model saved to {save_path}")


def create_dataloader(dataset_path, processor, batch_size=8, is_training=True):
    """Create DataLoader from dataset"""
    # TODO: Implement dataset loading
    from torch.utils.data import Dataset
    
    class OCRDataset(Dataset):
        def __init__(self, images, texts, processor):
            self.images = images
            self.texts = texts
            self.processor = processor
        
        def __len__(self):
            return len(self.images)
        
        def __getitem__(self, idx):
            image = self.images[idx]
            text = self.texts[idx]
            
            pixel_values = self.processor(image, return_tensors="pt").pixel_values.squeeze()
            labels = self.processor.tokenizer(
                text,
                return_tensors="pt",
                padding="max_length",
                max_length=128
            ).input_ids.squeeze()
            
            return {
                'pixel_values': pixel_values,
                'labels': labels
            }
    
    dataset = OCRDataset([], [], processor)
    return DataLoader(dataset, batch_size=batch_size, shuffle=is_training)


def main():
    parser = argparse.ArgumentParser(description='LoRA Fine-tuning for OCR')
    parser.add_argument('--model_name', type=str, default='microsoft/trocr-base-printed',
                       help='Base model name')
    parser.add_argument('--dataset_path', type=str, required=True,
                       help='Path to training dataset')
    parser.add_argument('--output_dir', type=str, default='models/ocr_lora',
                       help='Output directory')
    parser.add_argument('--rank', type=int, default=16,
                       help='LoRA rank')
    parser.add_argument('--alpha', type=int, default=32,
                       help='LoRA alpha (scaling factor)')
    parser.add_argument('--target_modules', nargs='+', 
                       default=['query', 'key', 'value'],
                       help='Target modules for LoRA')
    parser.add_argument('--epochs', type=int, default=5,
                       help='Number of epochs')
    parser.add_argument('--batch_size', type=int, default=8,
                       help='Batch size')
    parser.add_argument('--learning_rate', type=float, default=3e-4,
                       help='Learning rate')
    
    args = parser.parse_args()
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    # MLflow tracking
    tracker = MLflowTracker()
    with tracker.start_run(run_name="ocr_lora"):
        tracker.log_params({
            'model_name': args.model_name,
            'rank': args.rank,
            'alpha': args.alpha,
            'target_modules': args.target_modules,
            'epochs': args.epochs
        })
        
        # Initialize trainer
        trainer = LoRAOCRTrainer(
            model_name=args.model_name,
            output_dir=args.output_dir,
            device=device,
            rank=args.rank,
            alpha=args.alpha,
            target_modules=args.target_modules
        )
        
        # Create dataloaders
        train_loader = create_dataloader(
            args.dataset_path,
            trainer.processor,
            batch_size=args.batch_size,
            is_training=True
        )
        
        val_loader = create_dataloader(
            args.dataset_path,
            trainer.processor,
            batch_size=args.batch_size,
            is_training=False
        )
        
        # Train
        trainer.train(
            train_dataloader=train_loader,
            val_dataloader=val_loader,
            epochs=args.epochs,
            learning_rate=args.learning_rate
        )
        
        print("LoRA fine-tuning complete!")


if __name__ == '__main__':
    main()

