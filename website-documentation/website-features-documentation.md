# Website Features Documentation

This document provides a detailed overview of the key features in the TikTok Slideshow Creator website.

## Table of Contents
1. [TikTok Preview](#tiktok-preview)
2. [File Browser](#file-browser)
3. [Edit Settings Column](#edit-settings-column)
4. [Saved Templates](#saved-templates)
5. [Bulk Posting to TikTok](#bulk-posting-to-tiktok)

---

## TikTok Preview

### Overview
The TikTok Preview component provides a realistic TikTok-style interface for previewing slideshows before posting to social media platforms.

### Key Features

#### **Interface Design**
- **TikTok-style UI**: Mimics the exact look and feel of the TikTok mobile app
- **Responsive Design**: Adapts to different screen sizes while maintaining TikTok's aspect ratio
- **Header Section**: Displays username, profile picture, and follow button
- **Main Video Area**: Shows the current slide with TikTok-style cropping
- **Side Interaction Panel**: Features like, comment, share, and profile buttons with mock engagement numbers
- **Bottom Content Area**: Displays title, caption, and hashtags

#### **Playback Controls**
- **Play/Pause Button**: Start and stop slideshow playback
- **Volume Control**: Mute/unmute audio (visual control, no actual audio)
- **Slide Navigation**: 
  - Left/right arrow buttons for manual navigation
  - Click on slide indicators at the bottom to jump to specific slides
  - Auto-advance every 3 seconds when playing
- **Slide Counter**: Shows current slide position (e.g., "2/5")

#### **Visual Features**
- **Aspect Ratio Support**: 
  - 9:16 (TikTok standard)
  - 3:4 (Instagram story)
  - 1:1 (Square)
  - Free-form option
- **Smooth Transitions**: Fade effects between slides
- **Text Overlays**: Editable text that appears on slides
  - Drag to reposition
  - Double-click to edit text
  - Customizable fonts, colors, and effects
  - Outline and glow effects

#### **Interactive Elements**
- **Mock Engagement**: Shows realistic like counts (24.5K), comments (203), shares (89)
- **Profile Interactions**: Follow button, profile picture
- **Remix Functionality**: Shuffles slide order for creative variations
- **Real-time Preview**: Updates immediately when settings change

### Technical Implementation
- Built with React and Framer Motion for smooth animations
- Uses CSS transforms and positioning for TikTok-accurate layout
- Supports both individual image slideshows and pre-built slideshows
- Integrates with aspect ratio selector in the toolbar

---

## File Browser

### Overview
The File Browser is the central hub for managing images, folders, and slideshows with advanced organization and interaction capabilities.

### Key Features

#### **Display Modes**
- **Grid View**: Thumbnail-based layout for visual browsing
- **List View**: Detailed table format with file information
- **Responsive Grid**: Automatically adjusts columns based on screen size
  - 2 columns on small screens
  - 3 columns on medium screens  
  - 4+ columns on large screens

#### **File Management**
- **Multi-format Support**: 
  - Images (JPG, PNG, etc.)
  - Slideshow files (.slideshow extension)
  - Folder organization
- **File Information**: Name, size, modification date, type
- **Thumbnail Generation**: Auto-generated previews for images
- **Drag & Drop**: 
  - Upload files by dragging from desktop
  - Move files between folders
  - Drop zones with visual feedback

#### **Selection System**
- **Single Click**: Toggle selection for individual items
- **Ctrl/Cmd + Click**: Multi-select individual items
- **Shift + Click**: Select range of items
- **Select All/Deselect All**: Bulk selection controls
- **Visual Indicators**: Checkmarks and highlighting for selected items
- **Separate Selection**: Independent selection for images and slideshows

#### **Bulk Actions**
- **Delete**: Remove multiple selected items with confirmation
- **Post to TikTok**: Direct posting for slideshows
- **Move to Folder**: Organize files into folders
- **Remix Images**: Shuffle selected image order

#### **Organization Tools**
- **Folder Creation**: Create nested folder structures
- **Folder Navigation**: Click to enter/exit folders
- **File Sorting**: 
  - Name (alphabetical)
  - Date (modification time)
  - File size
  - Custom order (for remixed arrangements)
- **Sort Direction**: Ascending/descending order

#### **Context Menus**
Right-click menus provide quick access to:
- **For Folders**: Rename, Delete, Properties
- **For Slideshows**: Load, Post to TikTok, Rename, Delete
- **General**: New Folder, Refresh, Properties

#### **Toolbar Controls**
- **Cut Length Selector**: Choose number of slides for slideshow creation (1-5)
- **Create from Template**: Generate slideshows using saved templates
- **Aspect Ratio Selector**: Set TikTok preview aspect ratio
- **View Mode Toggle**: Switch between grid and list views
- **Sort Controls**: Change sorting criteria and direction

### Technical Implementation
- Uses React with Framer Motion for smooth animations
- Implements drag and drop with HTML5 Drag API
- Real-time file system synchronization
- Optimized rendering for large file collections
- Folder-based data isolation and management

---

## Edit Settings Column

### Overview
The Edit Settings Column provides comprehensive controls for customizing slideshow content and appearance before posting.

### Key Features

#### **Content Customization**
- **Title Editing**: Set slideshow title and post-specific titles
- **Caption Management**: Write and edit post captions
- **Hashtag System**: 
  - Add/remove hashtags
  - Tag combinations and variations
  - Character count tracking
- **Text Overlays**: 
  - Add text to specific slides
  - Position and style text
  - Multiple text layers per slide
  - Link text to specific slide positions for template reuse

#### **Visual Settings**
- **Aspect Ratio Selection**:
  - 9:16 (TikTok standard)
  - 3:4 (Instagram Stories)
  - 1:1 (Square posts)
  - Custom ratios
- **Transition Effects**:
  - Fade transitions
  - Slide transitions
  - Zoom effects
- **Music Controls**: Enable/disable background music

#### **Advanced Options**
- **Cut Length Settings**: Control how many slides to include
- **Slide Order**: Manual reordering or remix functionality
- **Template Application**: Apply saved template settings
- **Preview Integration**: Real-time preview in TikTok Preview component

#### **Settings Synchronization**
- **Real-time Updates**: Changes immediately reflect in preview
- **Template Persistence**: Save settings as reusable templates
- **Import/Export**: Save and load setting configurations

### User Experience
- **Intuitive Interface**: Easy-to-use controls with immediate feedback
- **Keyboard Shortcuts**: Quick actions for power users
- **Undo/Redo**: History management for setting changes
- **Reset Options**: Return to default settings easily

---

## Saved Templates

### Overview
The Saved Templates system allows users to create, store, and reuse slideshow configurations for consistent content creation with automatic bulk slideshow generation and advanced randomization features.

### Key Features

#### **Template Creation**

##### **Creation Methods**
- **From Slideshow**: Save current slideshow settings as a template
- **From Settings**: Create templates without existing slideshows using current edit settings
- **Flexible Requirements**: Templates can be created from just title, caption, and hashtags (minimum)
- **Custom Naming**: Descriptive names and descriptions
- **Preview System**: Visual preview of template content before creation
- **Automatic Detection**: Suggest template names based on content
- **Settings Validation**: Ensures required fields (title, caption, hashtags) are filled before template creation

##### **Creation Interface**
- **Template Preview**: Shows what will be included in the template:
  - Title and caption
  - Number of slides and hashtags
  - Text overlay count and positions
  - Aspect ratio and transition settings
- **Smart Defaults**: Suggests template names based on slideshow content
- **Description Field**: Optional but recommended for template organization

#### **Template Components**
Templates store the following settings:
- **Content**: Title, caption, hashtags
- **Visual**: Aspect ratio, transition effects
- **Structure**: Number of slides, text overlay positions linked to specific slides
- **Text Overlays**: Full text overlay configuration with slide-specific positioning
  - Text overlays are linked to specific slide numbers within the template
  - When applied to new slideshows, text overlays maintain their relative slide positions
- **Styling**: Font choices, colors, effects
- **Music**: Background music preferences
- **Slide Mapping**: Text overlays are mapped to specific slide indices that persist across template applications

#### **Bulk Creation Workflow**

##### **Step 1: Template Selection**
- **Template Gallery**: Visual grid of all saved templates
- **Expandable Details**: Click template to view full configuration:
  - Complete title, post title, and caption
  - Full hashtag list with # symbols
  - Transition effects and music settings
  - Text overlay information and positions
- **Smart Validation**: System ensures templates are applicable before showing options

##### **Step 2: Configuration Options**
- **Apply to Settings Mode**: Populates edit settings for manual slideshow creation
- **Bulk Creation Mode**: Automatically generates multiple slideshows
- **Customization Options**: Override title, caption, hashtags before application
- **Image Selection**: Choose selected images or all available images for processing

##### **Step 3: Advanced Randomization**

###### **Picture Randomization**
- **Shuffle Images**: Randomly distribute selected images across generated slideshows
- **Duplicate Prevention**: Ensures no duplicate images within the same slideshow
- **Variety Creation**: Prevents similar images from appearing together
- **Smart Distribution**: Maintains slideshow quality while maximizing variety

###### **Hashtag Randomization**
- **Advanced Hashtag Selection**: Interactive dialog for choosing specific hashtags
  - Search and filter available hashtags from template
  - Select up to 20 hashtags per slideshow
  - Preview hashtag combinations before application
- **Combination Generation**: Create different hashtag sets for each generated slideshow
- **Template Consistency**: Maintains template's hashtag structure while varying combinations
- **Custom Hashtags**: Add new hashtags beyond template's available tags

##### **Step 4: Bulk Slideshow Generation**
- **Automatic Grouping**: Images are intelligently grouped into slideshows based on template slide count
- **Sequential Naming**: Generated slideshows get automatic names (e.g., "Post 1", "Post 2", "Post 3")
- **Settings Preservation**: All template settings applied to each slideshow:
  - Text overlays positioned on appropriate slides
  - Aspect ratio and transition effects
  - Caption and hashtag structure
- **Quality Assurance**: Each slideshow validated before creation

#### **Template Features**

##### **Randomization Engine**
- **Dual Randomization**: Independent control over image and hashtag randomization
- **Smart Constraints**: 
  - No duplicate images per slideshow
  - Hashtag limit enforcement (20 per slideshow)
  - Maintains template structure integrity
- **Preview Generation**: Shows randomized combinations before creation
- **Batch Processing**: Handles large image sets efficiently

##### **Advanced Customization**
- **Content Override**: Modify title, caption, specific hashtags before bulk creation
- **Selective Application**: Apply to currently selected images or process all available images
- **Template Chaining**: Use different templates for different image sets
- **Settings Inheritance**: Templates can inherit and modify other template settings

#### **Template Management**
- **Cloud Storage**: Templates saved to user account and accessible across sessions
- **Organization Tools**: List view with template details and usage statistics
- **Search Functionality**: Find templates by name, content, or configuration
- **Version Control**: Track template updates and maintain history
- **Usage Analytics**: Monitor which templates perform best

#### **Application Interfaces**

##### **Template Selection Dialog**
- **Large Modal Interface**: Comprehensive template selection and configuration
- **Expandable Template Cards**: Click to reveal full template details
- **Real-time Preview**: See configuration changes immediately
- **Progress Indicators**: Loading states and processing feedback
- **Error Handling**: Clear error messages and recovery options

##### **Hashtag Selection Tool**
- **Interactive Hashtag Browser**: Search, filter, and select hashtags
- **Visual Tag Display**: Show hashtags with # symbols and categories
- **Limit Enforcement**: Prevent selection of more than 20 hashtags
- **Combination Preview**: See selected hashtag sets before confirmation
- **Quick Selection**: Common hashtag combinations as presets

##### **Bulk Creation Interface**
- **Step-by-step Wizard**: Guided process for bulk template application
- **Configuration Summary**: Final review before creating slideshows
- **Progress Tracking**: Real-time updates during slideshow generation
- **Result Reporting**: Summary of created slideshows and any issues

#### **User Interface Components**

##### **Template Manager Panel**
- **Quick Actions**: Save as Template and Apply Template buttons
- **Template Preview**: Show first 5 templates with expand option
- **Bulk Upload Helper**: Quick access to select all images for processing
- **Usage Statistics**: Template usage count and last used date
- **Notification System**: Success/error feedback for template operations

##### **Advanced Features**
- **Template Export/Import**: Share templates between users
- **Template Categories**: Organize templates by type or purpose
- **Bulk Template Operations**: Apply multiple templates simultaneously
- **Template Analytics**: Performance tracking and optimization suggestions

### Complete Workflow Example

#### **Scenario: Creating Product Promotion Slideshows**
1. **Template Creation**:
   - Configure slideshow with product name, price, call-to-action text overlays
   - Set 3-slide structure with specific text positions for each slide
   - Add hashtags like: product, sale, discount, trending, viral, etc.
   - Save as "Product Promotion Template"

2. **Image Preparation**:
   - Upload 30 product images from different categories
   - Images have various aspect ratios and orientations

3. **Bulk Template Application**:
   - Select all 30 product images
   - Open "Create from Template" dialog
   - Choose "Product Promotion Template"
   - Enable "Randomize Pictures" for variety
   - Enable "Randomize Hashtags" and select 15 tags from template's 30 available tags
   - Preview shows: 10 slideshows will be created (30 images ÷ 3 slides each)

4. **Hashtag Customization**:
   - Open hashtag selection dialog
   - Search for "product" and "sale" tags
   - Select specific tags: #product, #sale, #discount, #trending, #viral, etc.
   - Limit to 15 hashtags per slideshow

5. **Generation Process**:
   - System creates 10 slideshows: "Post 1" through "Post 10"
   - Each slideshow gets 3 randomly selected product images
   - Text overlays positioned on slides 1, 2, 3 of each slideshow
   - 15 hashtags randomly selected and assigned to each slideshow
   - All slideshows maintain template's aspect ratio and transition effects

6. **Quality Assurance**:
   - Each slideshow validated for content completeness
   - Text overlays checked for proper positioning
   - Hashtag combinations verified for uniqueness
   - Image quality assessed for TikTok optimization

### Template Structure
```typescript
interface SlideshowTemplate {
  id: string;
  name: string;
  description?: string;
  title: string;
  postTitle?: string;
  caption: string;
  hashtags: string[];
  slideCount: number;
  aspectRatio: string;
  transitionEffect: 'fade' | 'slide' | 'zoom';
  musicEnabled: boolean;
  textOverlays: TextOverlay[];
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TextOverlay {
  id: string;
  slideIndex: number; // Links to specific slide in template
  text: string;
  x: number; // Position as percentage
  y: number; // Position as percentage
  width: number; // Width as percentage
  height: number; // Height as percentage
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: string;
  alignment: 'left' | 'center' | 'right';
  bold: boolean;
  italic: boolean;
  outline: boolean;
  outlineColor: string;
  outlineWidth: number;
  glow: boolean;
  glowColor: string;
  glowIntensity: number;
}
```

---

## Bulk Posting to TikTok

### Overview
The Bulk Posting system enables users to schedule and post multiple slideshows to TikTok accounts automatically through the Postiz platform, integrating seamlessly with the template workflow and supporting the advanced randomization features.

### Key Features

#### **Account Management**
- **Multi-Account Support**: Post to multiple TikTok accounts simultaneously
- **Account Selection**: Choose specific accounts for posting
- **Account Validation**: Verify account connectivity and permissions
- **Auto-Detection**: Automatically find TikTok accounts in Postiz

#### **Posting Strategies**

##### **Strategy 1: Scheduled Intervals**
- **Start Time Setting**: Choose when to begin posting
- **Interval Configuration**: Set time between posts (30 min to 24 hours)
- **Batch Scheduling**: Schedule all posts at once
- **Time Constraints**: Automatic adjustment for optimal posting times
  - No posting between 12 AM - 9 AM
  - Posts after 10 PM move to next day at 9 AM

##### **Strategy 2: Immediate + Scheduled**
- **First Post Now**: Post the first slideshow immediately
- **Remaining Scheduled**: Schedule rest at set intervals
- **Engagement Optimization**: Immediate content for instant engagement
- **Gradual Rollout**: Staggered posting for sustained visibility

#### **Integration with Template Workflow**
- **Direct from Creation**: Post slideshows immediately after template-based bulk creation
- **Batch Selection**: Choose multiple slideshows created from templates
- **Consistent Formatting**: All slideshows from same template maintain posting consistency
- **Scheduled Consistency**: Apply same posting strategy across all template-generated content
- **Randomization Preservation**: Maintain randomized image and hashtag combinations in posted content

#### **Posting Schedule**
- **Timeline Preview**: Visual calendar of posting schedule
- **Real-time Status**: Track posting progress and results
- **Error Handling**: Retry failed posts automatically
- **Schedule Adjustment**: Modify times before posting

#### **Content Management**
- **Slideshow Validation**: Ensure all slideshows have required content
- **Image Optimization**: Automatic resizing for TikTok requirements
- **Caption Processing**: Format captions and hashtags for TikTok
- **Media Upload**: Handle bulk image uploads to Postiz storage
- **Template Consistency**: Maintain template branding across all posts
- **Randomization Preservation**: Keep unique image combinations and hashtag sets

#### **Monitoring & Results**
- **Post Status Tracking**: Success/failure for each post
- **Progress Indicators**: Visual progress during bulk posting
- **Error Reporting**: Detailed error messages for failed posts
- **Success Confirmation**: Post IDs and confirmation messages
- **Template Performance**: Track which templates generate best engagement
- **Randomization Analytics**: Monitor variety and effectiveness of randomized content

#### **User Interface**
- **Bulk Poster Dialog**: Large dialog for bulk operations
- **Strategy Selection**: Choose posting approach
- **Schedule Preview**: Review timeline before posting
- **Account Selection**: Multi-select TikTok accounts
- **Real-time Updates**: Live status during posting process
- **Template Integration**: Quick access to recently created template slideshows
- **Randomization Summary**: View image and hashtag randomization settings before posting

### Complete End-to-End Workflow

#### **Full Process: Template to Posted Content**

1. **Template Setup**:
   - Create template with text overlays, aspect ratio, captions, hashtags
   - Configure randomization preferences and hashtag sets
   - Save template for reuse

2. **Content Creation**:
   - Select multiple images from File Browser
   - Apply "Create from Template" with randomization options
   - Generate multiple slideshows with consistent structure
   - Review randomized combinations before confirmation

3. **Bulk Posting Preparation**:
   - Select generated slideshows for posting
   - Choose TikTok accounts and posting strategy
   - Review schedule and content variety
   - Validate randomization settings

4. **Execution**:
   - Upload all slideshow content to Postiz
   - Schedule posts according to strategy
   - Monitor posting progress and handle errors
   - Track individual post success/failure

5. **Results**:
   - All slideshows posted with consistent branding
   - Text overlays preserved on each slide
   - Randomized content maintains uniqueness
   - Optimized posting schedule for maximum engagement

### Technical Implementation

#### **API Integration**
- **Postiz API**: Integration with Postiz platform for posting
- **File Upload Service**: Handles bulk image uploads
- **Authentication**: Secure API key management
- **Rate Limiting**: Respects platform posting limits
- **Template Synchronization**: Maintains template integrity across posts
- **Randomization Engine**: Preserves unique combinations during posting

#### **Error Handling**
- **Network Failures**: Retry logic for connection issues
- **API Errors**: Graceful handling of platform errors
- **Validation Errors**: Prevent invalid posts
- **User Feedback**: Clear error messages and suggestions
- **Template Recovery**: Maintain template settings if individual posts fail
- **Randomization Backup**: Preserve randomization settings during recovery

#### **Performance Optimization**
- **Concurrent Uploads**: Parallel processing of multiple slideshows
- **Progress Tracking**: Real-time update system
- **Memory Management**: Efficient handling of large bulk operations
- **Cancellation**: Ability to cancel ongoing bulk operations
- **Batch Processing**: Optimize template application across multiple slideshows
- **Randomization Caching**: Cache randomization results for consistency

### Posting Workflow
1. **Template Selection**: Choose from saved templates or create new ones
2. **Bulk Slideshow Creation**: Apply template to multiple selected images with randomization
3. **Slideshow Review**: Preview generated slideshows and randomization results
4. **Account Selection**: Choose target TikTok accounts
5. **Strategy Selection**: Pick posting approach and timing
6. **Schedule Preview**: Review posting timeline and content variety
7. **Validation**: Check all requirements are met and randomization settings
8. **Execution**: Start bulk posting process
9. **Monitoring**: Track progress and handle results
10. **Completion**: Receive final report and post confirmations

---

## Integration Between Features

### Complete Workflow Integration
1. **Template Creation**: Create reusable templates with text overlays and settings
2. **Advanced Selection**: Select multiple images for bulk processing
3. **Template Application**: Apply template with randomization options
4. **Bulk Generation**: Create multiple slideshows with unique combinations
5. **Preview & Review**: Use TikTok Preview to verify slideshow quality
6. **Bulk Posting**: Schedule and post all generated slideshows to TikTok

### Data Flow
- **Template Synchronization**: Text overlays and settings persist across all slideshows
- **Randomization Preservation**: Unique combinations maintained throughout workflow
- **Real-time Updates**: Changes in one component update others immediately
- **State Management**: Centralized state ensures consistency across features
- **Bulk Operations**: Efficient handling of large-scale content creation

### User Experience Benefits
- **Efficiency**: Streamlined workflow from template creation to bulk posting
- **Consistency**: Templates ensure brand standards across all content
- **Automation**: Template-based bulk creation with randomization saves significant time
- **Quality Control**: Multiple preview and editing stages ensure polished results
- **Scalability**: Create and post dozens of slideshows with consistent quality and unique content
- **Creative Variety**: Randomization prevents content fatigue while maintaining brand consistency

---

*This documentation covers the core features of the TikTok Slideshow Creator website. For technical implementation details, refer to the component source code and API documentation.*