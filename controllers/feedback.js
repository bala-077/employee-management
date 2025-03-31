// routes/feedback.js
const express = require('express');
const router = express.Router();
const Feedback = require('../models/feedback');
const feedback = require('../models/feedback');

// Submit feedback
router.post('/submit', async (req, res) => {
    try {
      const { userId, projectId, reviewedBy, ...rest } = req.body;
  
      // Check if feedback already exists for this user-project-reviewer combination
      const existingFeedback = await Feedback.findOne({
        userId,
        projectId,
        reviewedBy
      });
  
      if (existingFeedback) {
        return res.status(400).json({ 
          message: 'Feedback already submitted for this developer and project' 
        });
      }
  
      const feedback = new Feedback({
        userId,
        projectId,
        reviewedBy,
        ...rest,
        submittedAt: new Date()
      });
  
      await feedback.save();
      res.status(201).json(feedback);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });

// Get all feedback for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ userId: req.params.userId })
      .sort({ submittedAt: -1 })
      .populate('projectId', 'projectname');
      
    res.json(feedbacks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all feedback for a project
router.get('/project/:projectId', async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ projectId: req.params.projectId })
      .sort({ submittedAt: -1 })
      .populate('userId', 'name userType');
      
    res.json(feedbacks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get average ratings for a user
router.get('/user/:userId/summary', async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ userId: req.params.userId });
    
    if (feedbacks.length === 0) {
      return res.json({ message: 'No feedback found for this user' });
    }

    // Calculate average ratings per skill
    const skillSummary = {};
    feedbacks.forEach(feedback => {
      feedback.skills.forEach(skill => {
        if (!skillSummary[skill.skillName]) {
          skillSummary[skill.skillName] = {
            total: 0,
            count: 0,
            average: 0
          };
        }
        skillSummary[skill.skillName].total += skill.rating;
        skillSummary[skill.skillName].count++;
      });
    });

    // Calculate averages
    for (const skill in skillSummary) {
      skillSummary[skill].average = 
        skillSummary[skill].total / skillSummary[skill].count;
    }

    res.json({
      totalFeedbacks: feedbacks.length,
      skillSummary,
      lastFeedback: feedbacks[0].submittedAt
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Check if feedback exists for a user-project combination
router.get('/check', async (req, res) => {
  try {
    const { userId, projectId } = req.query;
    
    if (!userId || !projectId) {
      return res.status(400).json({ 
        message: 'User ID and Project ID are required' 
      });
    }

    const existingFeedback = await Feedback.findOne({
      userId,
      projectId,
      reviewedBy: req.headers.authorization?.split(' ')[1] // Get the reviewer from token
    });

    res.json({ exists: !!existingFeedback });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all feedback
router.get('/all', async (req, res) => {
    try {
      const feedbacks = await Feedback.find()
        
        
      res.json(feedbacks);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
  

// Helper functions for visualization
const processSkillData = (feedback, visualizationData) => {
  feedback.skills.forEach(skill => {
    // Process skill distribution
    if (!visualizationData.skillDistribution[skill.skillName]) {
      visualizationData.skillDistribution[skill.skillName] = {
        total: 0,
        count: 0,
        average: 0,
        ratings: []
      };
    }
    visualizationData.skillDistribution[skill.skillName].total += skill.rating;
    visualizationData.skillDistribution[skill.skillName].count++;
    visualizationData.skillDistribution[skill.skillName].ratings.push(skill.rating);

    // Process user performance
    if (!visualizationData.userPerformance[feedback.userId._id]) {
      visualizationData.userPerformance[feedback.userId._id] = {
        name: feedback.userId.name,
        userType: feedback.userId.userType,
        totalRating: 0,
        feedbackCount: 0,
        averageRating: 0,
        skills: {}
      };
    }
    visualizationData.userPerformance[feedback.userId._id].totalRating += skill.rating;
    visualizationData.userPerformance[feedback.userId._id].feedbackCount++;

    // Process project performance
    if (!visualizationData.projectPerformance[feedback.projectId._id]) {
      visualizationData.projectPerformance[feedback.projectId._id] = {
        name: feedback.projectId.projectname,
        totalRating: 0,
        feedbackCount: 0,
        averageRating: 0
      };
    }
    visualizationData.projectPerformance[feedback.projectId._id].totalRating += skill.rating;
    visualizationData.projectPerformance[feedback.projectId._id].feedbackCount++;
  });
};

const calculateAverages = (visualizationData) => {
  let totalRating = 0;
  let totalRatingsCount = 0;

  // Calculate skill averages
  Object.keys(visualizationData.skillDistribution).forEach(skill => {
    const skillData = visualizationData.skillDistribution[skill];
    skillData.average = skillData.total / skillData.count;
    totalRating += skillData.total;
    totalRatingsCount += skillData.count;
  });

  // Calculate user averages
  Object.keys(visualizationData.userPerformance).forEach(userId => {
    const user = visualizationData.userPerformance[userId];
    user.averageRating = user.totalRating / user.feedbackCount;
  });

  // Calculate project averages
  Object.keys(visualizationData.projectPerformance).forEach(projectId => {
    visualizationData.projectPerformance[projectId].averageRating = 
      visualizationData.projectPerformance[projectId].totalRating / 
      visualizationData.projectPerformance[projectId].feedbackCount;
  });

  return { totalRating, totalRatingsCount };
};

const getRecentFeedbacks = (feedbacks) => {
  return feedbacks
    .sort((a, b) => b.submittedAt - a.submittedAt)
    .slice(0, 5)
    .map(feedback => ({
      userId: feedback.userId._id,
      userName: feedback.userId.name,
      projectId: feedback.projectId._id,
      projectName: feedback.projectId.projectname,
      submittedAt: feedback.submittedAt,
      averageRating: feedback.skills.reduce((acc, skill) => acc + skill.rating, 0) / feedback.skills.length
    }));
};

// Get feedback visualization data
router.get('/visualization', async (req, res) => {
  try {
    const feedbacks = await Feedback.find()
      .populate('userId', 'name userType')
      .populate('projectId', 'projectname');

    const visualizationData = {
      skillDistribution: {},
      userPerformance: {},
      projectPerformance: {},
      recentFeedbacks: [],
      summary: {
        totalFeedbacks: feedbacks.length,
        totalUsers: 0,
        totalProjects: 0,
        averageRating: 0
      }
    };

    // Process feedback data
    feedbacks.forEach(feedback => processSkillData(feedback, visualizationData));
    
    // Calculate averages and get totals
    const { totalRating, totalRatingsCount } = calculateAverages(visualizationData);
    
    // Get recent feedbacks
    visualizationData.recentFeedbacks = getRecentFeedbacks(feedbacks);
    
    // Calculate summary statistics
    visualizationData.summary.totalUsers = Object.keys(visualizationData.userPerformance).length;
    visualizationData.summary.totalProjects = Object.keys(visualizationData.projectPerformance).length;
    visualizationData.summary.averageRating = totalRating / totalRatingsCount;

    res.json(visualizationData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get feedback statistics with pagination and filters
router.get('/statistics', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      userId,
      projectId,
      startDate,
      endDate,
      sortBy = 'submittedAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};
    if (userId) query.userId = userId;
    if (projectId) query.projectId = projectId;
    if (startDate || endDate) {
      query.submittedAt = {};
      if (startDate) query.submittedAt.$gte = new Date(startDate);
      if (endDate) query.submittedAt.$lte = new Date(endDate);
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get total count for pagination
    const total = await Feedback.countDocuments(query);

    // Get paginated feedbacks
    const feedbacks = await Feedback.find(query)
      .populate('userId', 'name userType')
      .populate('projectId', 'projectname')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Calculate statistics with null checks
    const stats = {
      totalFeedbacks: total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      feedbacksPerPage: parseInt(limit),
      feedbacks: feedbacks.map(feedback => ({
        id: feedback._id,
        userId: feedback.userId?._id || feedback.userId,
        userName: feedback.userId?.name || 'Unknown User',
        projectId: feedback.projectId?._id || feedback.projectId,
        projectName: feedback.projectId?.projectname || 'Unknown Project',
        submittedAt: feedback.submittedAt,
        averageRating: feedback.skills.length > 0 
          ? feedback.skills.reduce((acc, skill) => acc + skill.rating, 0) / feedback.skills.length
          : 0,
        skills: feedback.skills.map(skill => ({
          name: skill.skillName,
          rating: skill.rating
        }))
      }))
    };

    res.json(stats);
  } catch (err) {
    console.error('Error in statistics endpoint:', err);
    res.status(500).json({ 
      message: 'Failed to fetch feedback statistics',
      error: err.message 
    });
  }
});

router.get('/users/all-data', async (req, res) => {
  try{
  const data = await feedback.find();
  res.status(200).json({data})
  }
  catch(err){
    res.status(500).json({ message: `some internal issue ${err.message}`})
  }
  
})

module.exports = router;