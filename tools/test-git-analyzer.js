#!/usr/bin/env node

/**
 * Test script for the Git analyzer functionality
 * This script demonstrates the Git analyzer capabilities and can be used for manual testing
 */

const { GitAnalyzer } = require('../dist/analyzers/git-analyzer');
const path = require('path');

async function testGitAnalyzer() {
  console.log('🔍 Starting Git Analyzer Test...\n');

  const projectPath = process.cwd();
  const gitAnalyzer = new GitAnalyzer(projectPath);

  try {
    // Check if this is a Git repository
    console.log('📂 Checking if current directory is a Git repository...');
    const isRepo = await gitAnalyzer.isGitRepository();
    
    if (!isRepo) {
      console.log('❌ Current directory is not a Git repository');
      console.log('   Please run this script from within a Git repository');
      return;
    }
    
    console.log('✅ Git repository detected\n');

    // Analyze the entire repository
    console.log('🔬 Analyzing repository...');
    const analysis = await gitAnalyzer.analyzeRepository();
    
    console.log('✅ Repository analysis complete\n');

    // Display repository information
    console.log('📊 Repository Information:');
    console.log(`   Branch: ${analysis.repositoryInfo.currentBranch}`);
    console.log(`   Remote URL: ${analysis.repositoryInfo.remoteUrl || 'Not configured'}`);
    console.log(`   Total Commits: ${analysis.repositoryInfo.totalCommits}`);
    console.log(`   Contributors: ${analysis.repositoryInfo.contributors.slice(0, 5).join(', ')}${analysis.repositoryInfo.contributors.length > 5 ? '...' : ''}`);
    console.log(`   Last Commit: ${analysis.repositoryInfo.lastCommit.message} (${analysis.repositoryInfo.lastCommit.author})`);
    console.log('');

    // Display recent activity
    console.log('📈 Recent Activity (Last 10 commits):');
    analysis.recentActivity.slice(0, 10).forEach((commit, index) => {
      const date = commit.date.toISOString().split('T')[0];
      const shortHash = commit.hash.substring(0, 7);
      const shortMessage = commit.message.length > 60 ? commit.message.substring(0, 57) + '...' : commit.message;
      console.log(`   ${index + 1}. [${shortHash}] ${shortMessage} - ${commit.author} (${date})`);
    });
    console.log('');

    // Display file histories
    console.log('📁 File Histories:');
    const fileEntries = Array.from(analysis.fileHistories.entries()).slice(0, 10);
    
    if (fileEntries.length === 0) {
      console.log('   No source files found in repository');
    } else {
      fileEntries.forEach(([filePath, history]) => {
        console.log(`   📄 ${filePath}:`);
        console.log(`      Commits: ${history.totalCommits}`);
        console.log(`      Authors: ${history.authors.slice(0, 3).join(', ')}${history.authors.length > 3 ? '...' : ''}`);
        console.log(`      Last modified: ${history.lastCommit.toISOString().split('T')[0]}`);
        console.log('');
      });
    }

    // Test specific file analysis
    const sourceFiles = Array.from(analysis.fileHistories.keys());
    if (sourceFiles.length > 0) {
      const testFile = sourceFiles[0];
      const testFilePath = path.join(projectPath, testFile);
      
      console.log(`🔍 Detailed Analysis for: ${testFile}`);
      
      // Get feature context
      const context = await gitAnalyzer.extractFeatureContext(testFilePath);
      
      console.log('   📋 Evolution Summary:');
      console.log(`      ${context.evolutionSummary}`);
      console.log('');
      
      console.log('   🔄 Change Patterns:');
      context.changePatterns.forEach(pattern => {
        console.log(`      ${pattern.type}: ${pattern.frequency} occurrences`);
        if (pattern.examples.length > 0) {
          console.log(`         Example: "${pattern.examples[0]}"`);
        }
      });
      console.log('');
      
      console.log('   👥 Main Contributors:');
      context.mainContributors.forEach((contributor, index) => {
        console.log(`      ${index + 1}. ${contributor}`);
      });
      console.log('');
      
      console.log('   📝 Recent Changes:');
      context.recentChanges.slice(0, 5).forEach((change, index) => {
        const date = change.date.toISOString().split('T')[0];
        const shortHash = change.hash.substring(0, 7);
        const shortMessage = change.message.length > 50 ? change.message.substring(0, 47) + '...' : change.message;
        console.log(`      ${index + 1}. [${shortHash}] ${shortMessage} (${date})`);
      });
      console.log('');

      // Test blame analysis
      console.log('   🔍 Blame Analysis (First 10 lines):');
      try {
        const blame = await gitAnalyzer.getFileBlame(testFilePath);
        const blameEntries = Array.from(blame.entries()).slice(0, 10);
        
        if (blameEntries.length > 0) {
          blameEntries.forEach(([lineNumber, info]) => {
            const date = info.date.toISOString().split('T')[0];
            const shortHash = info.hash.substring(0, 7);
            console.log(`      Line ${lineNumber}: ${info.author} [${shortHash}] (${date})`);
          });
        } else {
          console.log('      No blame information available');
        }
      } catch (error) {
        console.log('      Blame analysis not available for this file');
      }
      console.log('');
    }

    // Test recent changes
    console.log('📅 Recent Changes (Last 7 days):');
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentChanges = await gitAnalyzer.getRecentChanges(sevenDaysAgo);
    
    if (recentChanges.length === 0) {
      console.log('   No changes in the last 7 days');
    } else {
      console.log(`   Found ${recentChanges.length} commits in the last 7 days:`);
      recentChanges.slice(0, 10).forEach((change, index) => {
        const date = change.date.toISOString().split('T')[0];
        const shortHash = change.hash.substring(0, 7);
        const shortMessage = change.message.length > 50 ? change.message.substring(0, 47) + '...' : change.message;
        const fileCount = change.filesChanged.length;
        console.log(`      ${index + 1}. [${shortHash}] ${shortMessage} - ${change.author} (${date}, ${fileCount} files)`);
      });
    }
    console.log('');

    // Performance statistics
    console.log('⚡ Performance Statistics:');
    console.log(`   Files analyzed: ${analysis.fileHistories.size}`);
    console.log(`   Recent commits processed: ${analysis.recentActivity.length}`);
    console.log(`   Total contributors: ${analysis.repositoryInfo.contributors.length}`);
    console.log('');

    console.log('✅ Git analyzer test completed successfully!');
    console.log('');
    console.log('💡 Key Features Demonstrated:');
    console.log('   ✓ Repository information extraction');
    console.log('   ✓ File history analysis');
    console.log('   ✓ Change pattern recognition');
    console.log('   ✓ Feature context extraction');
    console.log('   ✓ Blame analysis');
    console.log('   ✓ Recent activity tracking');
    console.log('   ✓ Evolution summary generation');

  } catch (error) {
    console.error('❌ Git analyzer test failed:', error.message);
    
    if (error.message.includes('Not a Git repository')) {
      console.log('');
      console.log('💡 To test the Git analyzer:');
      console.log('   1. Navigate to a Git repository');
      console.log('   2. Run this script again');
      console.log('   3. Or initialize a Git repository with: git init');
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Test interrupted by user');
  process.exit(0);
});

// Run the test
testGitAnalyzer().catch(console.error);