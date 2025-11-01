"""
Train teacher OCR model for knowledge distillation.

This script trains a large OCR model (teacher) that will be used
to teach a smaller student model via knowledge distillation.
"""

import argparse
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from transformers import (
    TrOCRProcessor,
    VisionEncoderDecoderModel,
    VisionEncoderDecoderConfig
)
from transformers import AdamW, get_cosine_schedule_with_warmup
import os
from pathlib import Path

from src.mlops.mlflow_tracking import MLflowTracker


class OCRTeacherTrainer:
    """Trainer for OCR teacher model"""
    
    def __init__(self, model_name, output_dir, device):
        self.device = device
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Load model and processor
        self.processor = TrOCRProcessor.from_pretrained(model_name)
        self.model = VisionEncoderDecoderModel.from_pretrained(model_name)
        self.model.to(device)
        
        print(f"Loaded teacher model: {model_name}")
    
    def train(self, train_dataloader, val_dataloader, epochs, learning_rate):
        """Train the teacher model"""
        
        # Setup optimizer and scheduler
        optimizer = AdamW(self.model.parameters(), lr=learning_rate)
        total_steps = len(train_dataloader) * epochs
        scheduler = get_cosine_schedule_with_warmup(
            optimizer,
            num_warmup_steps=int(0.1 * total_steps),
            num_training_steps=total_steps
        )
        
        # Training loop
        best_val_loss = float('inf')
        
        for epoch in range(epochs):
            self.model.train()
            train_loss = 0.0
            
            for batch_idx, batch in enumerate(train_dataloader):
                # Move batch to device
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
        """Save model checkpoint"""
        save_path = self.output_dir / name
        save_path.mkdir(exist_ok=True)
        
        self.model.save_pretrained(save_path)
        self.processor.save_pretrained(save_path)
        
        print(f"Model saved to {save_path}")


def create_dataloader(dataset_path, processor, batch_size=8, is_training=True):
    """Create DataLoader from dataset"""
    # TODO: Implement dataset loading
    # This is a placeholder - implement based on your data format
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
    
    # Placeholder data - replace with actual dataset loading
    dataset = OCRDataset([], [], processor)
    return DataLoader(dataset, batch_size=batch_size, shuffle=is_training)


def main():
    parser = argparse.ArgumentParser(description='Train OCR teacher model')
    parser.add_argument('--model_name', type=str, default='microsoft/trocr-large-printed',
                       help='Pretrained model name')
    parser.add_argument('--dataset_path', type=str, required=True,
                       help='Path to training dataset')
    parser.add_argument('--output_dir', type=str, default='models/ocr_teacher',
                       help='Output directory for model')
    parser.add_argument('--epochs', type=int, default=10,
                       help='Number of training epochs')
    parser.add_argument('--batch_size', type=int, default=8,
                       help='Batch size')
    parser.add_argument('--learning_rate', type=float, default=5e-5,
                       help='Learning rate')
    parser.add_argument('--val_split', type=float, default=0.2,
                       help='Validation split ratio')
    
    args = parser.parse_args()
    
    # Setup device
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    # Initialize MLflow tracking
    tracker = MLflowTracker()
    with tracker.start_run(run_name=f"ocr_teacher_{args.model_name}"):
        tracker.log_params({
            'model_name': args.model_name,
            'epochs': args.epochs,
            'batch_size': args.batch_size,
            'learning_rate': args.learning_rate
        })
        
        # Initialize trainer
        trainer = OCRTeacherTrainer(
            model_name=args.model_name,
            output_dir=args.output_dir,
            device=device
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
        
        print("Training complete!")


if __name__ == '__main__':
    main()

