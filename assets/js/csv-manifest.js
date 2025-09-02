/*
 CSV_MANIFEST

 Extended manifest / edition-config schema to support multiple SSC editions
 and provide metadata needed by the normalization + advancement layer.

 Each edition entry may contain:
   - formatVersion: numeric, to allow backwards-compatible parsing
   - files: { votes, submissions } filenames in assets/csv/
   - columnMap (optional): maps canonical fields to CSV column indexes for custom formats
   - orderedStages (optional): UI stage ordering for non-numeric weeks
   - rules (optional): data-driven advancement rules (top N, per-group rules, etc.)
*/
window.CSV_MANIFEST = {
   editions: {
       6: {
           formatVersion: 6,
           files: {
               votes: 'SSC6_Votes_list.csv',
               submissions: 'SSC6_submissions.csv'
           },
           // legacy CSVs: column indexes assumed by current SSC6 parser
           columnMap: {
               id: 0,
               songName: 1,
               week: 2,
               points: 3,
               votes12: 4,
               votes10: 5,
               votes8: 6,
               votes7: 7,
               votes6: 8,
               votes5: 9,
               votes4: 10,
               votes3: 11,
               votes2: 12,
               votes1: 13,
               numVoters: 14,
               avgPoints: 15,
               weeklyRank: 16,
               result: 17
           },
           stages: {
               type: 'legacy',
               description: 'Numeric weeks + special labels in result field (2nd-chance, Finals)'
           }
       },

       // Placeholder SSC7 config. Replace CSV filenames and columnMap indexes as needed.
       7: {
           formatVersion: 7,
           files: {
               votes: 'SSC7_Votes_list.csv',
               submissions: 'SSC7_submissions.csv'
           },
           // Example column map for SSC7 if different from SSC6.
           columnMap: {
               id: 0,
               songName: 1,
               stageLabel: 2,     // e.g., "Bunk A", "Showcase 1", "Track Save", "2nd-chance", "Finals"
               pointsRaw: 3,
               votes12: 4,
               votes10: 5,
               votes8: 6,
               votes7: 7,
               votes6: 8,
               votes5: 9,
               votes4: 10,
               votes3: 11,
               votes2: 12,
               votes1: 13,
               numVoters: 14,
               avgPoints: 15,
               weeklyRank: 16,
               result: 17,
               // If there's a dedicated bonus column, point its index here (update when known)
               bonusPoints: 18
           },
           // Ordered stages help the UI present weeks/stages in the intended order.
           orderedStages: [
               {
                   id: 'bunk',
                   label: 'Bunk Week',
                   type: 'bunk',
                   groups: 10,
                   groupPrefix: 'Group ',
                   // Explicit labels in the exact order they should appear in the UI.
                   groupLabels: [
                       'Group A',
                       'Group A#',
                       'Group B',
                       'Group C',
                       'Group C#',
                       'Group D',
                       'Group D#',
                       'Group E',
                       'Group F',
                       'Group G'
                   ]
               },
               { id: 'showcase', label: 'Showcase Weeks', type: 'sequential', weeks: 5, weekPrefix: 'Week ' },
               { id: 'tracksave', label: 'Track Save', type: 'single', labelValue: 'Track save week' },
               { id: 'second_chance', label: '2nd Chance', type: 'single', labelValue: '2nd Chance' },
               { id: 'finals', label: 'Finals', type: 'single', labelValue: 'Final' }
           ],
           // Points in this edition's votes CSV already include bonus; do NOT add bonus again.
           pointsRawIncludesBonus: true,
           // Edition-specific advancement rules for SSC7:
           // - For Group weeks (e.g., "Group A", "Group B") advance:
           //     * top 20 => Showcase (or marked "Showcase")
           //     * next 20 => Track Save Week (or marked "Track Save Week")
           // - For non-group weeks, fall back to top 5 finalists + 5 second chance.
           // The UI and normalization layer will prefer explicit 'result' flags in the CSV when present,
           // otherwise apply these counts using descending points ordering.
           advancement: {
               groupStage: {
                   showcaseCount: 20,
                   trackSaveCount: 20,
                   // selection by descending points; if CSV has explicit result flags those are used first
                   selection: 'by_points'
               },
               nonGroup: {
                   finalistsCount: 5,
                   secondChanceCount: 5,
                   selection: 'by_points'
               }
           }
       },
   },

   // Return the raw files object for an edition
   getEditionFiles(edition) {
       const cfg = this.editions[edition];
       if (!cfg) {
           console.warn(`No edition config found for SSC${edition}`);
           return null;
       }
       return cfg.files || null;
   },

   // Return the full edition config (metadata) for use by the normalization layer
   getEditionConfig(edition) {
       const cfg = this.editions[edition];
       if (!cfg) {
           console.warn(`No edition config found for SSC${edition}`);
           return null;
       }
       return cfg;
   },

   // List available edition numbers sorted
   getAllEditions() {
       const editions = Object.keys(this.editions).map(Number).sort((a, b) => a - b);
       return editions;
   }
};
