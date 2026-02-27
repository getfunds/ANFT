'use client';

import { useState, useEffect } from 'react';
import { AnchorProvider } from '@coral-xyz/anchor';
import {
  resolveDID,
  getProgram,
} from '../../utils/solanaDID';
import { fetchAttestationsForDID } from '../../utils/sasAttestation';
import { getConnection } from '../../utils/solanaWallet';
import DIDProfileView from '../../components/DIDProfileView';
import styles from './did.module.css';

export default function DIDSearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [profile, setProfile] = useState(null);
  const [attestations, setAttestations] = useState([]);
  const [isLoadingAttestations, setIsLoadingAttestations] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) {
      setSearchQuery(q);
      handleSearch(q);
    }
  }, []);

  const handleSearch = async (query = searchQuery) => {
    const trimmed = (query || '').trim();
    if (!trimmed) {
      setSearchError('Please enter a username or DID string');
      return;
    }

    try {
      setIsSearching(true);
      setSearchError('');
      setProfile(null);
      setAttestations([]);

      const connection = getConnection();
      const readOnlyProvider = new AnchorProvider(
        connection,
        { publicKey: null, signTransaction: async (tx) => tx, signAllTransactions: async (txs) => txs },
        { preflightCommitment: 'confirmed' }
      );
      const program = getProgram(readOnlyProvider);
      const result = await resolveDID(program, trimmed);

      if (!result) {
        setSearchError(`No DID found for "${trimmed}". Check the username or DID string.`);
        return;
      }

      setProfile(result);
      window.history.replaceState({}, '', `/did?q=${encodeURIComponent(trimmed)}`);

      setIsLoadingAttestations(true);
      try {
        const atts = await fetchAttestationsForDID(result.did);
        setAttestations(atts);
      } catch {
      } finally {
        setIsLoadingAttestations(false);
      }
    } catch (error) {
      setSearchError(`Search failed: ${error.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.searchHeader}>
        <h1 className={styles.pageTitle}>Explore Creators</h1>
        <p className={styles.pageSubtitle}>
          Search by username or DID to view any creator&apos;s profile and NFT collection
        </p>
        <div className={styles.searchBar}>
          <svg className={styles.searchIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="e.g. alice-art  or  did:anft:..."
            className={styles.searchInput}
            disabled={isSearching}
          />
          <button
            onClick={() => handleSearch()}
            disabled={isSearching || !searchQuery.trim()}
            className={styles.searchBtn}
          >
            {isSearching ? <span className={styles.spinner} /> : 'Search'}
          </button>
        </div>
        {searchError && (
          <p className={styles.errorMsg}>{searchError}</p>
        )}
      </div>

      {profile && (
        <DIDProfileView
          profile={profile}
          attestations={attestations}
          isLoadingAttestations={isLoadingAttestations}
        />
      )}

      {!profile && !isSearching && !searchError && (
        <div className={styles.emptyState}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p>Search for a creator to see their profile and NFTs</p>
        </div>
      )}
    </div>
  );
}
