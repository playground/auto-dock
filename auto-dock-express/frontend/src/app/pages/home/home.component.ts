import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit {
  
  constructor(
    private router: Router,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    // If user is already logged in, redirect to chat
    if (this.authService.isLoggedIn) {
      this.router.navigate(['/chat']);
    }
  }

  startChat(): void {
    this.router.navigate(['/chat']);
  }
}

// Made with Bob
