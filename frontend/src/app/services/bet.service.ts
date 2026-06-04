import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Match {
  id: String;
  groupKey: string;
  round: string;
  time: string;
  homeTeamName: string;
  homeTeamFlag: string;
  awayTeamName: string;
  awayTeamFlag: string;
  homeTeamGoals?: number;
  awayTeamGoals?: number;
  status?: string;
  elapsedMinutes?: number;
}

export interface Bet {
  id?: string;
  date?: string;
  name: string;
  username?: string;
  stake: number;
  matchId: string;
  matchName?: string;
  betType: string;
  status?: string; // pending, won, lost
  payout?: number;
}

@Injectable({
  providedIn: 'root'
})
export class BetService {
  private http = inject(HttpClient);

  private getApiUrl(): string {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://127.0.0.1:3000/api';
      }
      return '/api';
    }
    return 'http://127.0.0.1:3000/api';
  }
  private apiUrl = this.getApiUrl();

  syncMatches(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/matches/sync`, {});
  }

  getMatches(): Observable<Match[]> {
    return this.http.get<Match[]>(`${this.apiUrl}/matches`);
  }

  getBets(): Observable<Bet[]> {
    return this.http.get<Bet[]>(`${this.apiUrl}/bets`);
  }

  placeBet(bet: Bet): Observable<Bet> {
    return this.http.post<Bet>(`${this.apiUrl}/bets`, bet);
  }

  updateBetStatus(id: string, status: string): Observable<Bet> {
    return this.http.put<Bet>(`${this.apiUrl}/bets/${id}/status?status=${status}`, {});
  }

  deleteBet(id: string, username: string): Observable<string> {
    return this.http.delete<string>(`${this.apiUrl}/bets/${id}`, {
      headers: { 'X-User-Username': username },
      responseType: 'text' as 'json'
    });
  }

  bulkDeleteBets(ids: string[], username: string): Observable<string> {
    return this.http.request<string>('delete', `${this.apiUrl}/bets/bulk`, {
      body: ids,
      headers: { 'X-User-Username': username },
      responseType: 'text' as 'json'
    });
  }

  login(credentials: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/auth/login`, credentials);
  }

  register(userData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/auth/register`, userData);
  }
}
