"""
Knowledge Distillation: Train student OCR model from teacher model.

This script implements knowledge distillation to create a smaller,
faster student model that learns from a larger teacher model.
"""

import argparse
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from transformers import AdamW, get_cosine_schedule_with_warmup
import os
from pathlib import Path

from src.mlops.mlflow_tracking import MLflowTracker


class DistillationLoss(nn.Module):
    """Knowledge distillation loss"""
    
    def __init__(self, temperature=5.0, alpha=0.5):
        super().__init__()
        self.temperature = temperature
        self.alpha = alpha
        self.kl_div = nn.KLDivLoss(reduction='batchmean')
        self.ce_loss = nn.CrossEntropyLoss()
    
    def forward(self, student_logits, teacher_logits, labels):
        """
        Compute distillation loss
        
        Args:
            student_logits: Student model logits
            teacher_logits: Teacher model logits
            labels: Ground truth labels
        """
        # Soft targets from teacher
        teacher_probs = torch.softmax(teacher_logits / self.temperature, dim=-1)
        student_log_probs = torch.log_softmax(student_logits / self.temperature, dim=-1)
        
        # Distillation loss (KL divergence)
        distillation_loss = self.kl_div(student_log_probs, teacher_probs) * (self.temperature ** 2)
        
        # Hard targets loss (ground truth)
        hard_loss = self.ce_loss(student_logits.view(-1, student_logits.size(-1)), labels.view(-1))
        
        # Combined loss
        total_loss = self.alpha * distillation_loss + (1 - self.alpha) * hard_loss
        
        return total_loss


class StudentDistillationTrainer:
    """Trainer for student model via knowledge distillation"""
    
    def __init__(self, teacher_model_path, student_model_name, output_dir, device, temperature, alpha):
        self.device = device
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.temperature = temperature
        self.alpha = alpha
        
        # Load teacher model (frozen)
        print(f"Loading teacher model from {teacher_model_path}")
        self.teacher_processor = TrOCRProcessor.from_pretrained(teacher_model_path)
        self.teacher_model = VisionEncoderDecoderModel.from_pretrained(teacher_model_path)
        self.teacher_model.to(device)
        self.teacher_model.eval()  # Freeze teacher
        
        # Load student model (trainable)
        print(f"Loading student model: {student_model_name}")
        self.student_processor = TrOCRProcessor.from_pretrained(student_model_name)
        self.student_model = VisionEncoderDecoderModel.from_pretrained(student_model_name)
        self.student_model.to(device)
        self.student_model.train()
        
        # Loss function
        self.criterion = DistillationLoss(temperature=temperature, alpha=alpha)
        
        print("Models loaded successfully")
    
    def train(self, train_dataloader, val_dataloader, epochs, learning_rate):
        """Train student model via distillation"""
        
        # Setup optimizer
        optimizer = AdamW(self.student_model.parameters(), lr=learning_rate)
        total_steps = len(train_dataloader) * epochs
        scheduler = get_cosine_schedule_with_warmup(
            optimizer,
            num_warmup_steps=int(0.1 * total_steps),
            num_training_steps=total_steps
        )
        
        best_val_loss = float('inf')
        
        for epoch in range(epochs):
            self.student_model.train()
            train_loss = 0.0
            
            for batch_idx, batch in enumerate(train_dataloader):
                pixel_values = batch['pixel_values'].to(self.device)
                labels = batch['labels'].to(self.device)
                
                # Teacher forward pass (no gradients)
                with torch.no_grad():
                    teacher_outputs = self.teacher_model(
                        pixel_values=pixel_values,
                        labels=labels
                    )
                    teacher_logits = teacher_outputs.logits
                
                # Student forward pass
                student_outputs = self.student_model(
                    pixel_values=pixel_values,
                    labels=labels
                )
                student_logits = student_outputs.logits
                
                # Compute distillation loss
                loss = self.criterion(student_logits, teacher_logits, labels)
                
                # Backward pass
                optimizer.zero_grad()
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.student_model.parameters(), 1.0)
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
        
        print(f"Distillation complete. Best validation loss: {best_val_loss:.4f}")
    
    def validate(self, val_dataloader):
        """Validate student model"""
        self.student_model.eval()
        total_loss = 0.0
        
        with torch.no_grad():
            for batch in val_dataloader:
                pixel_values = batch['pixel_values'].to(self.device)
                labels = batch['labels'].to(self.device)
                
                # Teacher predictions
                with torch.no_grad():
                    teacher_outputs = self.teacher_model(
                        pixel_values=pixel_values,
                        labels=labels
                    )
                    teacher_logits = teacher_outputs.logits
                
                # Student predictions
                student_outputs = self.student_model(
                    pixel_values=pixel_values,
                    labels=labels
                )
                student_logits = student_outputs.logits
                
                # Compute loss
                loss = self.criterion(student_logits, teacher_logits, labels)
                total_loss += loss.item()
        
        return total_loss / len(val_dataloader)
    
    def save_model(self, name):
        """Save student model"""
        save_path = self.output_dir / name
        save_path.mkdir(exist_ok=True)
        
        self.student_model.save_pretrained(save_path)
        self.student_processor.save_pretrained(save_path)
        
        print(f"Student model saved to {save_path}")


def create_dataloader(dataset_path, processor, batch_size=8, is_training=True):
    """Create DataLoader from dataset"""
    # TODO: Implement dataset loading
    # Placeholder - implement based on your data format
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
    parser = argparse.ArgumentParser(description='Knowledge Distillation for OCR')
    parser.add_argument('--teacher_model', type=str, required=True,
                       help='Path to teacher model')
    parser.add_argument('--student_model', type=str, default='microsoft/trocr-small-printed',
                       help='Student model name')
    parser.add_argument('--dataset_path', type=str, required=True,
                       help='Path to training dataset')
    parser.add_argument('--output_dir', type=str, default='models/ocr_student',
                       help='Output directory')
    parser.add_argument('--epochs', type=int, default=10,
                       help='Number of epochs')
    parser.add_argument('--batch_size', type=int, default=16,
                       help='Batch size')
    parser.add_argument('--learning_rate', type=float, default=5e-5,
                       help='Learning rate')
    parser.add_argument('--temperature', type=float, default=5.0,
                       help='Distillation temperature')
    parser.add_argument('--alpha', type=float, default=0.5,
                       help='Distillation loss weight')
    
    args = parser.parse_args()
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    # MLflow tracking
    tracker = MLflowTracker()
    with tracker.start_run(run_name="ocr_distillation"):
        tracker.log_params({
            'teacher_model': args.teacher_model,
            'student_model': args.student_model,
            'temperature': args.temperature,
            'alpha': args.alpha,
            'epochs': args.epochs
        })
        
        # Initialize trainer
        trainer = StudentDistillationTrainer(
            teacher_model_path=args.teacher_model,
            student_model_name=args.student_model,
            output_dir=args.output_dir,
            device=device,
            temperature=args.temperature,
            alpha=args.alpha
        )
        
        # Create dataloaders
        train_loader = create_dataloader(
            args.dataset_path,
            trainer.student_processor,
            batch_size=args.batch_size,
            is_training=True
        )
        
        val_loader = create_dataloader(
            args.dataset_path,
            trainer.student_processor,
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
        
        print("Distillation complete!")


if __name__ == '__main__':
    main()

