import { Injectable } from '@angular/core';

/**
 * Zero Angular Service
 * Provides integration between Zero by Rocicorp and Angular applications
 */
@Injectable({
  providedIn: 'root',
})
export class ZeroAngularService {
  // Placeholder service for Zero Angular integration
  getVersion(): string {
    return '0.0.0';
  }
}
