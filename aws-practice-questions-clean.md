# AWS Practice Questions

Questions and options only, with the correct answer shown below each question.

## Question 1

In order to quickly troubleshoot their systems, your manager instructed you to record the calls that your application makes to all AWS services and resources. You developed a custom code that will send the segment documents directly to X-Ray by using the PutTraceSegments API.

What should you include in your segment document to meet the above requirement?

A. annotations
B. metadata
C. subsegments
D. tracing header

**Correct answer:** C. subsegments

## Question 2

You are planning to create a DynamoDB table for your employee profile website. This will be used by the Human Resources department to easily view details about each employee.

When choosing the partition key of the table, which of the following is the BEST attribute to use?

A. employee_id because each employee ID is unique.
B. employee_name because this will speed up searching of records.
C. department_id since employees will fall in these departments.
D. position_id because this will help sort the records per department.

**Correct answer:** A. employee_id because each employee ID is unique.

## Question 3

A mobile game is currently being developed and needs to have an authentication service. You need to use an AWS service which provides temporary AWS credentials for users who have been authenticated via their social media logins as well as for guest users who do not require any authentication.

How can you BEST achieve this using AWS?

A. Use Amazon Cognito Sync.
B. Use AWS Cognito Identity Pools then enable access to unauthenticated identities.
C. Use AWS IAM Identity Center.
D. Use AWS Cognito User Pools then enable access to unauthenticated identities.

**Correct answer:** B. Use AWS Cognito Identity Pools then enable access to unauthenticated identities.

## Question 4

A Docker application hosted on an ECS cluster has encountered intermittent unavailability issues and timeouts. The lead DevOps engineer instructed you to instrument the application to detect where high latencies are occurring and to determine the specific services and paths impacting application performance.

Which of the following steps should you take to accomplish this task properly? (Select TWO.)

A. Manually install the X-Ray daemon to the instances via a user data script.
B. Configure the port mappings and network mode settings in the container agent to allow traffic on TCP port 2000.
C. Create a Docker image that runs the X-Ray daemon, upload it to a Docker image repository, and then deploy it to your Amazon ECS cluster.
D. Add the xray-daemon.config configuration file in your Docker image.
E. Configure the port mappings and network mode settings in your task definition file to allow traffic on UDP port 2000.

**Correct answer:** C. Create a Docker image that runs the X-Ray daemon, upload it to a Docker image repository, and then deploy it to your Amazon ECS cluster.; E. Configure the port mappings and network mode settings in your task definition file to allow traffic on UDP port 2000.

## Question 5

A developer is instrumenting an application that will be hosted in a large On-Demand EC2 instance in AWS. All of the downstream calls invoked by the application must be traced properly, including the AWS SDK calls. A user-defined data should also be present to expedite the troubleshooting process.

Which of the following are valid considerations in AWS X-Ray that the developer should follow? (Select TWO.)

A. Set the namespace subsegment field to remote for AWS SDK calls and aws for other downstream calls.
B. Set the namespace subsegment field to aws for AWS SDK calls and remote for other downstream calls.
C. Set the metadata object with any additional custom data that you want to store in the segment.
D. Set the metadata object with key-value pairs that you want X-Ray to index for search.
E. Set the annotations object with any additional custom data that you want to store in the segment.

**Correct answer:** B. Set the namespace subsegment field to aws for AWS SDK calls and remote for other downstream calls.; C. Set the metadata object with any additional custom data that you want to store in the segment.

## Question 6

A developer is building an application that will be hosted in ECS and must be configured to run tasks and services using the Fargate launch type. The application will have four different tasks, each of which will access different AWS resources than the others.

Which of the following is the MOST efficient solution that can provide your application in ECS access to the required AWS resources?

A. Create 4 different Service-Linked Roles with the required permissions and attach them to each of the 4 ECS tasks.
B. Create 4 different IAM Roles with the required permissions and attach them to each of the 4 ECS tasks.
C. Create an IAM Group with all the required permissions and attach them to each of the 4 ECS tasks.
D. Create 4 different Container Instance IAM Roles with the required permissions and attach them to each of the 4 ECS tasks.

**Correct answer:** B. Create 4 different IAM Roles with the required permissions and attach them to each of the 4 ECS tasks.

## Question 7

A company has a website hosted in a multicontainer Docker environment in Elastic Beanstalk. There is a requirement to integrate the website with API Gateway, where it simply passes client-submitted method requests to the backend. It is important that the client and backend interact directly with no intervention from API Gateway after the API method is set up, except for known issues such as unsupported characters.

Which of the following integration types is the MOST suitable one to use to meet this requirement?

A. HTTP_PROXY
B. AWS_PROXY
C. AWS
D. HTTP

**Correct answer:** A. HTTP_PROXY

## Question 8

You recently deployed an application to a newly created AWS account, which uses two identical Lambda functions to process ad-hoc requests. The first function processes incoming requests efficiently but the second one has a longer processing time even though both of the functions have exactly the same code. Based on your monitoring, the Throttles metric of the second function is greater than the first one in Amazon CloudWatch.

Which of the following are possible solutions that you can implement to fix this issue? (Select TWO.)

A. Set the concurrency execution limit of both functions to 450.
B. Configure the second function to use an unreserved account concurrency.
C. Set the concurrency execution limit of both functions to 500.
D. Decrease the concurrency execution limit of the first function.
E. Set the concurrency execution limit of the second function to 0.

**Correct answer:** A. Set the concurrency execution limit of both functions to 450.; D. Decrease the concurrency execution limit of the first function.

## Question 9

An ECS Cluster has a running X-Ray Daemon that enables developers to easily debug and troubleshoot their application. However, the trace data being sent to AWS X-Ray is still not as detailed as your manager wants it to be. There is a new requirement that requires the application to provide more granular timing information and more details about its downstream calls to various AWS resources.

What should you do to satisfy this requirement?

A. Use subsegments
B. Use inferred segment
C. Use annotations
D. Use metadata

**Correct answer:** A. Use subsegments

## Question 10

Your manager assigned you a task of implementing server-side encryption with customer-provided encryption keys (SSE-C) to your S3 bucket, which will allow you to set your own encryption keys. Amazon S3 will manage both the encryption and decryption process using your key when you access your objects, which will remove the burden of maintaining any code to perform data encryption and decryption.

To properly upload data to this bucket, which of the following headers must be included in your request?

A. x-amz-server-side​-encryption​-customer-algorithm, x-amz-server-side-encryption-customer-key and x-amz-server-side-encryption-customer-key-MD5 headers
B. x-amz-server-side-encryption-customer-key header only
C. x-amz-server-side-encryption, x-amz-server-side-encryption-customer-key and x-amz-server-side-encryption-customer-key-MD5 headers
D. x-amz-server-side-encryption and x-amz-server-side-encryption-aws-kms-key-id headers

**Correct answer:** A. x-amz-server-side​-encryption​-customer-algorithm, x-amz-server-side-encryption-customer-key and x-amz-server-side-encryption-customer-key-MD5 headers

## Question 11

A developer is using API Gateway Lambda Authorizer to provide authentication for every API request and control access to your API. The requirement is to implement an authentication strategy which is similar to OAuth or SAML.

Which of the following is the MOST suitable method that the developer should use in this scenario?

A. Token-based Authorization
B. Request Parameter-based Authorization
C. Cross-Account Lambda Authorizer
D. AWS STS-based Authentication

**Correct answer:** A. Token-based Authorization

## Question 12

A developer is instructed to collect data on the number of times that web visitors click the advertisement link of a popular news website. A database entry containing the count will be incremented for every click. Given that the website has millions of readers worldwide, your database should be configured to provide optimal performance to capture all the click events.

What is the BEST service that the developer should implement in this scenario?

A. Launch an Amazon Redshift for the database and apply a step count of 1 for the IDENTITY column.
B. Use Amazon RDS for the database and setup SQL AUTO_INCREMENT on your tables.
C. Set up Amazon DynamoDB for the database and implement atomic counters for UpdateItem operation of the website counter.
D. Take advantage of Amazon Aurora's performance speed and AUTO_INCREMENT feature for item updates.

**Correct answer:** C. Set up Amazon DynamoDB for the database and implement atomic counters for UpdateItem operation of the website counter.

## Question 13

A serverless application consisting of a Lambda function and a DynamoDB database is used to process Amazon S3 events. The Lambda function takes an average of three seconds to process the data and Amazon S3 publishes 10 events per second.

What is the concurrent execution that the function will have?

A. 30
B. 10
C. 3
D. 13

**Correct answer:** A. 30

## Question 14

A multinational company uses Amazon EC2 Auto Scaling to maintain a fleet of EC2 instances behind an Application Load Balancer (ALB). The Amazon EC2 instances are configured with the Amazon CloudWatch agent to collect and publish custom metrics. However, the newly launched EC2 instances within the Auto Scaling group fail to send the metrics to Amazon CloudWatch.

What changes are required to ensure the custom metrics are sent from all newly launched EC2 instances?

A. Add a user data script in the EC2 Auto Scaling launch template to install and start the CloudWatch agent during instance initialization.
B. Attach the CloudWatchAgentAdminPolicy IAM policy to the IAM role specified in the EC2 Auto Scaling launch template to provide enhanced permissions for the CloudWatch agent.
C. Attach the CloudWatchAgentServerPolicy policy to the IAM role specified in the EC2 Auto Scaling launch template to ensure proper permissions for the CloudWatch agent.
D. Configure the IAM role for the EC2 instances with the CloudWatchAgentReadOnlyAccess policy to allow the CloudWatch agent to read default metrics and publish data.

**Correct answer:** C. Attach the CloudWatchAgentServerPolicy policy to the IAM role specified in the EC2 Auto Scaling launch template to ensure proper permissions for the CloudWatch agent.

## Question 15

A developer is building the cloud architecture of an application which will be hosted in a large EC2 instance. The application will process the data and it will upload results to an S3 bucket.

Which of the following is the SAFEST way to implement this architecture?

A. Store the access keys in the instance then use the AWS SDK to upload the results to S3.
B. Install the AWS CLI then use it to upload the results to S3.
C. Use an IAM Inline Policy to grant the application the necessary permissions to upload data to S3.
D. Use an IAM Role to grant the application the necessary permissions to upload data to S3.

**Correct answer:** D. Use an IAM Role to grant the application the necessary permissions to upload data to S3.

## Question 16

You have an application that reads an individual item from a DynamoDB table, modifies it locally, and submits the changes as a new entry to a separate table before proceeding onto the next item. The process is repeated for the next 100 entries, and it consumes a lot of time performing this entire process.

Which strategy can be applied to your application in order to shorten the time needed to process all the necessary entries with MINIMAL configuration?

A. Use DynamoDB's BatchGetItem and BatchWriteItem API operations.
B. Deploy your application into a cluster of EC2 instances.
C. Use DynamoDB conditional writes.
D. Modify your application to use multithreading.

**Correct answer:** A. Use DynamoDB's BatchGetItem and BatchWriteItem API operations.

## Question 17

A leading commercial bank has an online banking portal that is hosted in an Auto Scaling group of EC2 instances with an Application Load Balancer in front to distribute the incoming traffic. The application has been instrumented, and the X-Ray daemon has been installed in all instances to allow debugging and troubleshooting using AWS X-Ray.

In this architecture, from which source will AWS X-Ray fetch the client IP address?

A. From the X-Forwarded-For header of the request.
B. From the X-Forwarded-Host header of the request.
C. From the ipAddress query parameter of the request if it exists.
D. From the source IP of the IP packet.

**Correct answer:** A. From the X-Forwarded-For header of the request.

## Question 18

A multinational e-commerce company hosts its product descriptions on an Amazon RDS database. All descriptions are originally written in English. Users can request on-demand translations via a Lambda function, which pulls the description and employs Amazon Translate's TranslateText API for the task. However, during sales of popular products, the surge in translation requests is stressing the RDS, causing increased response times.

How can a developer improve the Lambda function's response time cost-effectively without performing database optimizations?

A. Update the Lambda function to use asynchronous invocation. Push the translation requests to an Amazon SQS queue and then process in batches.
B. Use the /tmp storage in the Lambda function to cache recently translated product descriptions
C. Store the results of the TranslateText API in an Amazon DynamoDB Accelerator (DAX) cluster.
D. Use AWS Step Functions with a Parallel state to concurrently run multiple instances of the Lambda function for translation.

**Correct answer:** B. Use the /tmp storage in the Lambda function to cache recently translated product descriptions

## Question 19

A developer wants to track the number of visitors on their website, which has a DynamoDB database. This is primarily used to give a rough idea on how many people visit the site whenever they launch a new advertisement, which means it can tolerate a slight overcounting or undercounting of website visitors.

Which of the following will satisfy the requirement with MINIMAL configuration?

A. Use conditional writes to update the counter item in the DynamoDB table and set the ReturnConsumedCapacity parameter to TOTAL.
B. Enable DynamoDB Streams to track the number of new visitors.
C. Use atomic counters to increment the counter item in the DynamoDB table for every new visitor.
D. Use conditional writes to update the counter item in the DynamoDB table only if the item has a unique primary key and the new value is greater than the current value.

**Correct answer:** C. Use atomic counters to increment the counter item in the DynamoDB table for every new visitor.

## Question 20

A company has an AWS account with only 2 Lambda functions, which process data and store the results in an S3 bucket. An Application Load Balancer is used to distribute the incoming traffic to the two Lambda functions as registered targets. You noticed that in peak times, the first Lambda function works with optimal performance but the second one is throttling the incoming requests.

Which of the following is the MOST likely root cause of this issue?

A. The first function is using the unreserved account concurrency while the second function has been set with a concurrency execution limit of 1000.
B. The concurrency execution limit provided to the first function is less than the second function.
C. The first function is using the unreserved account concurrency while the second function has been set with a concurrency execution limit of 800.
D. The concurrency execution limit provided to the first function is significantly higher than the second function.

**Correct answer:** D. The concurrency execution limit provided to the first function is significantly higher than the second function.

## Question 21

A write-heavy data analytics application is using DynamoDB database which has global secondary index. Whenever the application is performing heavy write activities on the table, the DynamoDB requests return a ProvisionedThroughputExceededException.

Which of the following is the MOST likely cause of this issue?

A. The provisioned write capacity for the global secondary index is less than the write capacity of the base table.
B. The provisioned write capacity for the global secondary index is greater than the write capacity of the base table.
C. The provisioned throughput exceeds the current throughput limit for your account.
D. The rate of requests exceeds the allowed throughput.

**Correct answer:** A. The provisioned write capacity for the global secondary index is less than the write capacity of the base table.

## Question 22

An application is hosted in Elastic Beanstalk, which is currently running in Java 7 runtime environment. A new version of the application is ready to be deployed, and the developer was tasked to upgrade the platform to Java 8 to accommodate the changes. All user traffic must be immediately directed to the new version. If problems arise, the developer should be able to quickly revert to the previous version.

Which of the following is the MOST appropriate action that the developer should do to upgrade the platform?

A. Update the environment's platform version to Java 8.
B. Manually upgrade the Java runtime environment of the EC2 instances in the Elastic Beanstalk environment.
C. Perform a Traffic splitting deployment.
D. Perform a Blue/Green Deployment.

**Correct answer:** D. Perform a Blue/Green Deployment.

## Question 23

A tech company has a real-time traffic monitoring system which uses Amazon Kinesis Data Stream to collect data and a group of EC2 instances that consume and process the data stream. Your development team is responsible for adjusting the number of shards in the data stream to adapt to changes in the rate of data flow.

Which of the following are correct regarding Kinesis resharding which your team should consider in managing the application? (Select TWO.)

A. You have to split the cold shards to decrease the capacity of the stream.
B. You can decrease the stream's capacity by merging shards.
C. You can increase the stream's capacity by splitting shards.
D. The data records that are flowing to the parent shards will be lost when you reshard.
E. You have to merge the hot shards to increase the capacity of the stream.

**Correct answer:** B. You can decrease the stream's capacity by merging shards.; C. You can increase the stream's capacity by splitting shards.

## Question 24

A company has a hybrid cloud architecture that connects its on-premises data center with AWS. The DevOps team has been tasked to set up the company's continuous integration and continuous delivery (CI/CD) systems. The application deployment to both Amazon EC2 instances and on-premises servers should also be automated.

Which of the following AWS service should be used to accomplish this?

A. AWS CloudFormation
B. AWS CodeBuild
C. AWS CodeDeploy
D. Amazon Kinesis

**Correct answer:** C. AWS CodeDeploy

## Question 25

A company has different AWS accounts, namely Account A, Account B, and Account C, which are used for their Development, Test, and Production environments respectively. A developer needs access to perform an audit whenever a new version of the application has been deployed to the Test (Account B) and production (Account C) environments.

What is the MOST efficient way to provide the developer access to execute the specified task?

A. Create separate identities and passwords for the developer on both the Test and Production accounts.
B. Set up AWS Organizations and attach a Service Control Policy to the developer to access the other accounts.
C. Grant the developer cross-account access to the resources of Accounts B and C.
D. Enable AWS multi-factor authentication (MFA) to the IAM User of the developer.

**Correct answer:** C. Grant the developer cross-account access to the resources of Accounts B and C.

## Question 26

A social media application is using DynamoDB to manage and store the session data of its users. As the number of users grew, the number of items in the table exponentially increased as well. You have to reduce storage usage and also reduce the cost of storing irrelevant data without using provisioned throughput to rectify this issue.

Which of the following is the MOST cost-effective solution that you should implement?

A. Turn on Time To Live (TTL) in the table.
B. Implement a Lazy Loading caching strategy to your application.
C. Use a Lambda function with CloudWatch Events to schedule a purge of stale items in the table on a daily basis.
D. Implement a Write-Through caching strategy in your application.

**Correct answer:** A. Turn on Time To Live (TTL) in the table.

## Question 27

A developer has a set of EC2 instances that runs the Amazon Kinesis Client Library to process a data stream in AWS. Based on the custom metrics, it shows that the instances are maxing out their CPU Utilization, and there are insufficient Kinesis shards to handle the rate of data flowing through the stream.

Which of the following is the BEST course of action that the developer should take to solve this issue and prevent this situation from re-occurring in the future?

A. Increase both the instance size and the number of open shards.
B. Increase the number of instances up to the number of open shards.
C. Increase the number of shards.
D. Increase the instance size to a larger type.

**Correct answer:** A. Increase both the instance size and the number of open shards.

## Question 28

A developer monitors multiple sensors inside a data center which detects various environmental conditions that may affect their running servers. In the current architecture, the data is initially processed by an AWS Lambda function and then stored in a remote data warehouse. To make the system more durable and scalable, the developer plans to use an Amazon SQS FIFO queue to store the data, which will be polled by the Lambda function. There is a known issue with the sensor devices sending duplicate data intermittently.

What action can the developer take to lessen the chances of processing duplicate messages?

A. Refactor the Lambda function to store the message's content and drop the incoming messages with similar content within a 5-minute period.
B. Add a MessageDeduplicationId parameter to the SendMessage API request.
C. Configure the Amazon SQS queue to automatically drop a duplicate message whenever it arrives within the message's VisibilityTimeout.
D. Use an Amazon SQS Standard queue instead of a FIFO queue to avoid any duplicate messages.

**Correct answer:** B. Add a MessageDeduplicationId parameter to the SendMessage API request.

## Question 29

A company has a central data repository in Amazon S3 that needs to be accessed by developers belonging to different AWS accounts. The required IAM role has been created with the appropriate S3 permissions.

Given that the developers mostly interact with S3 via APIs, which API should the developers call to use the IAM role?

A. AssumeRoleWithWebIdentity
B. GetSessionToken
C. AssumeRole
D. AssumeRoleWithSAML

**Correct answer:** C. AssumeRole

## Question 30

Due to the popularity of serverless computing, your manager instructed you to share your technical expertise to the whole software development department of your company. You are planning to deploy a simple Node.js 'Hello World' Lambda function to AWS using CloudFormation.

Which of the following is the EASIEST way of deploying the function to AWS?

A. Include your function source inline in the Code parameter of the AWS::Lambda::Function resource in the CloudFormation template.
B. Upload the code in S3 then specify the S3Key and S3Bucket parameters under the AWS::Lambda::Function resource in the CloudFormation template.
C. Upload the code in S3 as a ZIP file then specify the S3 path in the ZipFile parameter of the AWS::Lambda::Function resource in the CloudFormation template.
D. Include your function source inline in the ZipFile parameter of the AWS::Lambda::Function resource in the CloudFormation template.

**Correct answer:** D. Include your function source inline in the ZipFile parameter of the AWS::Lambda::Function resource in the CloudFormation template.

## Question 31

A serverless application is using API Gateway with a non-proxy Lambda Integration. A developer was tasked to expose a GET method on a new /getcourses resource to invoke the Lambda function, which will allow the consumers to fetch a list of online courses in JSON format. The consumers must include a query string parameter named courseType in their request to get the data.

What is the MOST efficient solution that the developer should do to accomplish this requirement?

A. Configure the integration request of the resource.
B. Configure the integration response of the resource.
C. Configure the method request of the resource.
D. Configure the method response of the resource.

**Correct answer:** C. Configure the method request of the resource.

## Question 32

A company has an AWS Amplify application, relying on Amazon Cognito for user authentication. Multi-factor authentication (MFA) is disabled for their User Pool. There has been a recent data breach in a popular website. The company is worried that attackers might exploit compromised email addresses and passwords to sign into their applications. For this reason, they want to enforce MFA only on users with suspicious login attempts.

How can the company satisfy these requirements?

A. Recreate the User Pool and enable SMS text message MFA.
B. Enable Adaptive Authentication for the User Pool
C. Enable the Time-based one-time password (TOTP) software token MFA for the User Pool
D. Create a subscription filter Lambda function that monitors for the CompromisedCredentialRisk metric from Advanced Security Metrics in CloudWatch Logs and triggers MFA when detected

**Correct answer:** B. Enable Adaptive Authentication for the User Pool

## Question 33

Your development team is currently developing a financial application in AWS. One of the requirements is to create and control the encryption keys used to encrypt your data using the envelope encryption strategy to comply with the strict IT security policy of the company.

Which of the following correctly describes the process of envelope encryption?

A. Encrypt plaintext data with a data key and then encrypt the data key with a top-level plaintext key.
B. Encrypt plaintext data with a KMS key and then encrypt the KMS key with a top-level plaintext data key.
C. Encrypt plaintext data with a KMS key and then encrypt the KMS key with a top-level encrypted data key.
D. Encrypt plaintext data with a data key and then encrypt the data key with a top-level encrypted key.

**Correct answer:** A. Encrypt plaintext data with a data key and then encrypt the data key with a top-level plaintext key.

## Question 34

An application has recently been migrated from an on-premises data center to a development Elastic Beanstalk environment. A developer will do iterative tests and therefore needs to deploy code changes and view them as quickly as possible.

Which of the following options take the LEAST amount of time to complete the deployment?

A. Rolling with additional batch
B. All at once
C. Immutable
D. Rolling

**Correct answer:** B. All at once

## Question 35

An online magazine is deployed in AWS and uses an Application Load Balancer, an Auto Scaling group of EC2 instances, and an RDS MySQL Database. Some of the readers are complaining about the website's sluggish performance when loading the articles. Upon checking, there is a high number of read operations in the database, which affects the website's performance.

Which of the following actions should you take to resolve the issue with minimal code change?

A. Upgrade the EC2 instances to a higher instance type.
B. Launch a large ElastiCache Cluster as a database cache for RDS and apply the required code change.
C. Create an RDS Read Replica instance and configure the application to use this for read queries.
D. Set up a multi-AZ deployments configuration in RDS.

**Correct answer:** C. Create an RDS Read Replica instance and configure the application to use this for read queries.

## Question 36

A development team is working on an AWS Serverless Application Model (SAM) application with its source code hosted on GitHub. A newly recruited developer clones the repository and observes that the SAM template contains references to AWS Lambda functions with CodeUri pointing to local file paths. The developer has added a new Lambda function and must redeploy the updated version to Production.

Which combination of steps must be taken to satisfy the requirement? (Select Two)

A. Use the sam sync command to synchronize the local changes to the application in AWS.
B. Execute sam build to resolve dependencies and construct deployment artifacts for all functions and layers in the SAM template.
C. Use the sam deploy command to deploy the application with a specified CloudFormation stack.
D. Run sam init to initialize a new SAM project.
E. Execute sam publish to make the application available in the AWS Serverless Application Repository.

**Correct answer:** B. Execute sam build to resolve dependencies and construct deployment artifacts for all functions and layers in the SAM template.; C. Use the sam deploy command to deploy the application with a specified CloudFormation stack.

## Question 37

You are developing a serverless application in AWS in which you have to control the code execution performance and costs of your Lambda functions. There is a requirement to increase the CPU available to your function in order to efficiently process records from an Amazon Kinesis data stream.

Which of the following is the BEST way to meet this requirement?

A. Increase the concurrent execution limit of the function.
B. Increase the allocated memory of the function.
C. Use Lambda@Edge.
D. Configure the function to use unreserved account concurrency.

**Correct answer:** B. Increase the allocated memory of the function.

## Question 38

You are developing a serverless application in AWS composed of several Lambda functions and a DynamoDB database. The requirement is to process the requests asynchronously.

Which of the following is the MOST suitable way to accomplish this?

A. Use the InvokeAsync API to call the Lambda function and set the invocation type request parameter to Event.
B. Use the InvokeAsync API to call the Lambda function and set the invocation type request parameter to RequestResponse.
C. Use the Invoke API to call the Lambda function and set the invocation type request parameter to Event.
D. Use the Invoke API to call the Lambda function and set the invocation type request parameter to RequestResponse.

**Correct answer:** C. Use the Invoke API to call the Lambda function and set the invocation type request parameter to Event.

## Question 39

A company is heavily using a range of AWS services to host their enterprise applications. Currently, their deployment process still has a lot of manual steps which is why they plan to automate their software delivery process using continuous integration and delivery (CI/CD) pipelines in AWS. They will use CodePipeline to orchestrate each step of their release process and CodeDeploy for deploying applications to various compute platforms in AWS.

In this architecture, which of the following are valid considerations when using CodeDeploy? (Select TWO.)

A. You have to install and use the CodeDeploy agent installed on your EC2 instances and ECS cluster.
B. CodeDeploy can deploy applications to EC2, AWS Lambda, and Amazon ECS only.
C. The CodeDeploy agent communicates using HTTP over port 80.
D. CodeDeploy can deploy applications to both your EC2 instances as well as your on-premises servers.
E. AWS Lambda compute platform deployments cannot use an in-place deployment type.

**Correct answer:** D. CodeDeploy can deploy applications to both your EC2 instances as well as your on-premises servers.; E. AWS Lambda compute platform deployments cannot use an in-place deployment type.

## Question 40

An organization has a serverless application using AWS Lambda, Amazon API Gateway. Recently, the DevOps team discovered that the IAM roles associated with the Lambda functions had been manually modified. The organization must identify these unauthorized changes and ensure all resources are in sync with the CloudFormation stack.

Which solution will help the company identify these changes?

A. Analyze CloudWatch Logs to identify changes to the IAM role permissions.
B. Use AWS Config to monitor updates made to the Lambda functions and IAM roles.
C. Run a drift detection check on the CloudFormation stack.
D. Review CloudTrail logs to trace IAM role updates for the Lambda functions.

**Correct answer:** C. Run a drift detection check on the CloudFormation stack.

## Question 41

An application in your development account is running in an AWS Elastic Beanstalk environment which has an attached Amazon RDS database. You noticed that if you terminate the environment, it also brings down the database which hinders you from performing seamless updates with blue-green deployments. This also poses a critical security risk if the company decides to deploy the application in production.

In this scenario, how can you decouple your database instance from your environment without having any data loss?

A. Use a Canary deployment strategy to decouple the Amazon RDS instance from your Elastic Beanstalk environment. Create an RDS DB snapshot of the database and enable deletion protection. Create a new Elastic Beanstalk environment with the necessary information to connect to the Amazon RDS instance and delete the old environment.
B. Use a Canary deployment strategy to decouple the Amazon RDS instance from your Elastic Beanstalk environment. Create an RDS DB snapshot of the database and then create a new Elastic Beanstalk environment with the necessary information to connect to the Amazon RDS instance.
C. Use the blue / green deployment strategy to decouple the Amazon RDS instance from your Elastic Beanstalk environment. Create an RDS DB snapshot of the database and enable deletion protection. Create a new Elastic Beanstalk environment with the necessary information to connect to the Amazon RDS instance and delete the old environment.
D. Use the blue / green deployment strategy to decouple the Amazon RDS instance from your Elastic Beanstalk environment. Create an RDS DB snapshot of the database and enable deletion protection. Create a new Elastic Beanstalk environment with the necessary information to connect to the Amazon RDS instance. Before terminating the old Elastic Beanstalk environment, remove its security group rule first before proceeding.

**Correct answer:** D. Use the blue / green deployment strategy to decouple the Amazon RDS instance from your Elastic Beanstalk environment. Create an RDS DB snapshot of the database and enable deletion protection. Create a new Elastic Beanstalk environment with the necessary information to connect to the Amazon RDS instance. Before terminating the old Elastic Beanstalk environment, remove its security group rule first before proceeding.

## Question 42

A developer is building a prototype microservices that are running as tasks in an Amazon ECS Cluster. His manager instructed him to define a task placement strategy which needs to be both cost and resource efficient. The task placement should minimize the number of instances in use which will keep the cost down since high availability is not much of a concern for this prototype.

What should the developer implement to meet the above requirements?

A. Distribute tasks evenly across Availability Zones, and then re-distribute the tasks among EC2 instances based on the least available amount of CPU/memory within each Availability Zone.
B. Place tasks randomly using the random task placement strategy.
C. Distribute tasks evenly across all available EC2 instances using the spread task placement strategy.
D. Distribute tasks among all registered EC2 instances based on the least available amount of CPU or memory using the binpack task placement strategy.

**Correct answer:** D. Distribute tasks among all registered EC2 instances based on the least available amount of CPU or memory using the binpack task placement strategy.

## Question 43

A company has 5 different applications running on several On-Demand EC2 instances. The DevOps team is required to set up a graphical representation of the key performance metrics for each application. These system metrics must be available on a single shared screen for more effective and visible monitoring.

Which of the following should the DevOps team do to satisfy this requirement using Amazon CloudWatch?

A. Set up a custom CloudWatch dimension with a unique metric name for each application.
B. Set up a custom CloudWatch Event with a unique metric name for each application.
C. Set up a custom CloudWatch namespace with a unique metric name for each application.
D. Set up a custom CloudWatch Alarm with a unique metric name for each application.

**Correct answer:** C. Set up a custom CloudWatch namespace with a unique metric name for each application.

## Question 44

A developer is creating a real-time auction app for second-hand cars using Kinesis Data Streams to ingest bids. The auction rules are as follows:

A bid must be processed only once

An EC2 instance consumer must process bids in the same order they were received.

Which solution will meet the requirement?

A. Embed a unique ID in each bid record. Use Kinesis PutRecords API to write bids. Assign a timestamp-based value for the PartitionKey parameter.
B. Replace the stream with an SQS FIFO queue and use the SendMessage API to write bids. Provide a unique id in the MessageDeduplicationId parameter for each bid request.
C. Replace the stream with an SQS FIFO queue and use the SendMessageBatch API to write bids. Provide a unique id in the MessageDeduplicationId parameter for each bid request.
D. Embed a unique ID in each bid record. Use Kinesis PutRecord API to write bids. Assign a timestamp-based value for the SequenceNumberForOrdering parameter.

**Correct answer:** D. Embed a unique ID in each bid record. Use Kinesis PutRecord API to write bids. Assign a timestamp-based value for the SequenceNumberForOrdering parameter.

## Question 45

An application is sending thousands of log files to an S3 bucket everyday. The request to retrieve the list of objects using the AWS CLI aws s3api list-objects command is timing out due to the high volume of data being fetched. In order to rectify this issue, you have to use pagination to control the number of results returned on your request.

Which of the following parameters should you include in CLI command for this scenario? (Select TWO.)

A. --page-size
B. --size-only
C. --max-items
D. --summarize
E. --exclude

**Correct answer:** A. --page-size; C. --max-items

## Question 46

You are hosting a website in an Amazon S3 bucket named tutorialsdojo and your users load the website using the http://tutorialsdojo.s3-website-us-east-1.amazonaws.com endpoint. You want to use JavaScript on the webpages that are stored in this bucket to be able to make authenticated GET and PUT requests. These requests are directed to the same bucket through the website.s3.amazonaws.com S3 API endpoint. However, you noticed that your web browser blocks the HTTP requests originating from your website.

What should you do to rectify this issue?

A. Enable cross-account access.
B. Enable Cross-Region Replication (CRR).
C. Enable Cross-Zone Load Balancing.
D. Enable Cross-origin resource sharing (CORS) configuration in the bucket.

**Correct answer:** D. Enable Cross-origin resource sharing (CORS) configuration in the bucket.

## Question 47

A company has developed a Lambda function that will send status updates to a third-party provider for analytics. You need to schedule this function to run every 30 minutes. Which of the following is the MOST manageable and cost-effective way of setting up this task?

A. Integrate Amazon EventBridge (Amazon CloudWatch Events) with Lambda, which will automatically trigger the function every 30 minutes.
B. Use the Task Scheduler of your Windows PC to trigger the Lambda function every 30 minutes.
C. Launch an EC2 instance that has a cron job that triggers the Lambda function every 30 minutes.
D. Enable scheduling on the AWS Console of your Lambda function. Define a schedule to run it at 30-minute intervals.

**Correct answer:** A. Integrate Amazon EventBridge (Amazon CloudWatch Events) with Lambda, which will automatically trigger the function every 30 minutes.

## Question 48

A developer is building an image processing utility using an AWS Lambda function. The function processes images in parallel using multiple threads to optimize performance. The images are stored in an Amazon S3 bucket and retrieved for processing. However, the function is not performing as efficiently as expected, with the processing time taking longer than anticipated, even when handling relatively small images.

Which action should the developer modify to achieve better performance in the AWS Lambda function?

A. Optimize memory allocation for the Lambda function.
B. Use AWS Step Functions to split tasks into smaller workflows.
C. Increase the timeout setting of the Lambda function.
D. Utilize Amazon S3 Transfer Acceleration for image uploads.

**Correct answer:** A. Optimize memory allocation for the Lambda function.

## Question 49

A developer wants to use multi-factor authentication (MFA) to protect programmatic calls to specific AWS API operations like Amazon EC2 StopInstances. He needs to call an API where he can submit the MFA code that is associated with his MFA device. Using the temporary security credentials that are returned from the call, he can then make programmatic calls to API operations that require MFA authentication.

Which API should the developer use to properly implement this security feature?

A. AssumeRoleWithWebIdentity
B. AssumeRoleWithSAML
C. GetFederationToken
D. GetSessionToken

**Correct answer:** D. GetSessionToken

## Question 50

A company is using AWS Organizations to manage its multiple AWS accounts which is being used by its various departments. To avoid security issues, it is of utmost importance to test the impact of service control policies (SCPs) on your IAM policies and resource policies before applying them.

Which of the following services can you use to test and troubleshoot IAM and resource-based policies?

A. Amazon Inspector
B. Systems Manager
C. IAM Policy Simulator
D. AWS Config

**Correct answer:** C. IAM Policy Simulator

## Question 51

A serverless application, which is composed of multiple Lambda functions, has been deployed using AWS SAM. A developer was instructed to easily manage the deployments of the functions using CodeDeploy. When there is a new deployment, 10 percent of the incoming traffic should be shifted to the new version every 10 minutes until all traffic is shifted from the old version.

What should the developer do to properly deploy the functions that satisfies this requirement?

A. Deploy the functions using a Linear deployment configuration.
B. Deploy the functions using an Immutable deployment configuration.
C. Deploy the functions using an All-at-once deployment configuration.
D. Deploy the functions using a Canary deployment configuration.

**Correct answer:** A. Deploy the functions using a Linear deployment configuration.

## Question 52

A company is re-architecting its legacy application to use AWS Lambda and DynamoDB. The table is provisioned to have 10 read capacity units, and each item has a size of 4 KB.

How many eventual and strong consistent read requests can the table handle per second?

A. 10 strongly consistent reads and 10 eventually consistent reads per second
B. 5 strongly consistent reads and 20 eventually consistent reads per second
C. 20 strongly consistent reads and 10 eventually consistent reads per second
D. 10 strongly consistent reads and 20 eventually consistent reads per second

**Correct answer:** D. 10 strongly consistent reads and 20 eventually consistent reads per second

## Question 53

A prototype application is hosted in an EC2 instance, which has an assigned IAM Role to store data from both the development and production S3 buckets. The instance also has AWS CLI access/secret key installed to handle other ad hoc tasks. You assigned a new IAM Role to the instance which has the permission to access the development bucket only. However, upon testing, the instance can still store files to both buckets.

What is the MOST likely root cause of this issue?

A. Due to eventual consistency, you must wait 24 hours for the change to appear across all of AWS.
B. The instance profile role of a running EC2 instance is static and can't be replaced at all.
C. The new IAM Role has an attached inline policy.
D. The application is still using the IAM role that is configured for the AWS CLI key.

**Correct answer:** D. The application is still using the IAM role that is configured for the AWS CLI key.

## Question 54

A developer is designing the cloud architecture of an internal application which will be used by about a hundred employees. She needs to ensure that the architecture is elastic enough to adequately match the supply of resources to the demand while maintaining its cost-effectiveness.

Which of the following services can provide the MOST elasticity to the architecture? (Select TWO.)

A. AWS WAF
B. Amazon RDS
C. Amazon EC2 Spot Fleet
D. Amazon CloudFront
E. Amazon DynamoDB

**Correct answer:** C. Amazon EC2 Spot Fleet; E. Amazon DynamoDB

## Question 55

An online forum requires a new table in DynamoDB named Thread in which the partition key is ForumName and the sort key is Subject. The following diagram shows how the items in the table would be organized:

For reporting purposes, the application needs to find all of the threads that have been posted in a particular forum within the last three months. Which of the following is the MOST effective solution that you should implement?

A. Create a global secondary index and use the Query operation to utilize the LastPostDateTime attribute as the sort key.
B. Add a local secondary index while creating the new Thread table. Use the Query operation to utilize the LastPostDateTime attribute as the sort key.
C. Configure the application to Query the entire Thread table and discard any posts that were not within the specified time frame.
D. Configure the application to Scan the entire Thread table and discard any posts that were not within the specified time frame.

**Correct answer:** B. Add a local secondary index while creating the new Thread table. Use the Query operation to utilize the LastPostDateTime attribute as the sort key.

## Question 56

A Java web application built using AWS SDK for Java with a DynamoDB database is concurrently accessed by thousands of users during peak time. The application is highly write-intensive and there are a lot of incidents where it overwrites stale data from the DynamoDB table.

How can you ensure your database writes are protected from being overwritten by other write operations that are occurring at the same time without affecting the application performance?

A. Implement pessimistic locking with write locking.
B. Implement overly optimistic locking (OOL).
C. Implement pessimistic locking with read locking.
D. Implement optimistic locking with version number.

**Correct answer:** D. Implement optimistic locking with version number.

## Question 57

A data analytics company has installed sensors to track the number of people that goes to the mall. The data sets are collected in real-time by an Amazon Kinesis Data Stream which has a consumer that is configured to process data every other day and store the results to S3. Your team noticed that your S3 bucket is only receiving half of the data that is being sent to the Kinesis stream but after checking, you have verified that the sensors are properly sending the data to Amazon Kinesis in real-time without any issues.

Which of the following is the MOST likely root cause of this issue?

A. The sensors are having intermittent connection issues.
B. The Amazon Kinesis Data Stream has too many open shards.
C. By default, the data records are only accessible for 24 hours from the time they are added to a Kinesis stream.
D. The Amazon Kinesis Data Stream automatically deletes duplicate data.

**Correct answer:** C. By default, the data records are only accessible for 24 hours from the time they are added to a Kinesis stream.

## Question 58

A developer needs to configure the environment name, solution stack, and environment links of his application environment which will be hosted in Elastic Beanstalk. Which configuration file should the developer add in the source bundle to meet the above requirement?

A. env.config
B. cron.yaml
C. Dockerrun.aws.json
D. env.yaml

**Correct answer:** D. env.yaml

## Question 59

Your team is developing a new feature on your application which is already hosted in Elastic Beanstalk. After several weeks, the new version of the application is ready to be deployed and you were instructed to handle the deployment.

What is the correct way to deploy the new version to Elastic Beanstalk via the CLI?

A. Package your application as a zip file and deploy it using the eb deploy command.
B. Package your application as a zip file and deploy it using the aws elasticbeanstalk update-application command.
C. Package your application as a tar file and deploy it using the aws elasticbeanstalk update-application command.
D. Package your application as a tar file and deploy it using the eb deploy command.

**Correct answer:** A. Package your application as a zip file and deploy it using the eb deploy command.

## Question 60

A company has a global multi-player game with a multi-master DynamoDB database topology which stores data in multiple AWS regions. You were assigned to develop a real-time data analytics application which will track and store the recent changes on all the tables from various regions. Only the new data of the recently updated item is needed to be tracked by your application.

Which of the following is the MOST suitable way to configure the data analytics application to detect and retrieve the updated database entries automatically?

A. Enable DynamoDB Streams and set the value of StreamViewType to NEW_IMAGE. Use Kinesis Adapter in the application to consume streams from DynamoDB.
B. Enable DynamoDB Streams and set the value of StreamViewType to NEW_AND_OLD_IMAGE. Use Kinesis Adapter in the application to consume streams from DynamoDB.
C. Enable DynamoDB Streams and set the value of StreamViewType to NEW_AND_OLD_IMAGE. Create a trigger in AWS Lambda to capture stream data and forward it to your application.
D. Enable DynamoDB Streams and set the value of StreamViewType to NEW_IMAGE. Create a trigger in AWS Lambda to capture stream data and forward it to your application.

**Correct answer:** A. Enable DynamoDB Streams and set the value of StreamViewType to NEW_IMAGE. Use Kinesis Adapter in the application to consume streams from DynamoDB.

## Question 61

A company is deploying the package of its Lambda function, which is compressed as a ZIP file, to AWS. However, they are getting an error in the deployment process because the package is too large. The manager instructed the developer to keep the deployment package small to make the development process much easier and more modularized. This should also help prevent errors that may occur when dependencies are installed and packaged with the function code.

Which of the following options is the MOST suitable solution that the developer should implement?

A. Zip the deployment package again to further compress the zip file.
B. Upload the other dependencies of your function as a separate Lambda Layer instead.
C. Compress the deployment package as TAR file instead.
D. Upload the deployment package to S3.

**Correct answer:** B. Upload the other dependencies of your function as a separate Lambda Layer instead.

## Question 62

You are developing an application that will use a Lambda function, which will be invoked asynchronously. The application will be implemented with exponential back-off that will handle failures so that the requests will be retried twice before the event is discarded. If the retries fail with an unexpected error, you have to direct unprocessed events to another service which will analyze the failure.

Which of the following is the MOST suitable component that you should implement in the application architecture to meet the above requirement?

A. Amazon MQ
B. Dead Letter Queue
C. Delay Queue
D. FIFO Queue

**Correct answer:** B. Dead Letter Queue

## Question 63

A developer is preparing the application specification (AppSpec) file in CodeDeploy, which will be used to deploy her Lambda functions to AWS. In the deployment, she needs to configure CodeDeploy to run a task before the traffic is shifted to the deployed Lambda function version.

Which deployment lifecycle event should she configure in this scenario?

A. Start
B. BeforeInstall
C. BeforeAllowTraffic
D. Install

**Correct answer:** C. BeforeAllowTraffic

## Question 64

Using AWS SAM, a developer recently deployed a serverless application consisting of Lambda functions, API Gateway, Kinesis Data stream, and a DynamoDB table. The application has worked fine for a few days, but lately, there were a lot of ProvisionedThroughputExceeded exceptions being returned by DynamoDB. The developer also noticed that there's a sudden increase in read capacity units (RCU) usage whenever this issue happens.

How should the developer refactor the application to find items based on primary key values and use the LEAST amount of RCU?

A. Use the Query operation with eventual consistency reads.
B. Use the Query operation with strong consistency reads.
C. Use the Scan operation with strong consistency reads.
D. Use the Scan operation with eventual consistency reads.

**Correct answer:** A. Use the Query operation with eventual consistency reads.

## Question 65

A developer has instrumented an application using the X-Ray SDK to collect all data about the requests that an application serves. There is a new requirement to develop a custom debug tool which will enable them to view the full traces of their application without using the X-Ray console.

What should the developer do to accomplish this task?

A. Use the BatchGetTraces API to get the list of trace IDs of the application and then retrieve the list of traces using GetTraceSummaries API.
B. Use the GetGroup API to get the list of trace IDs of the application and then retrieve the list of traces using BatchGetTraces API.
C. Use the GetTraceSummaries API to get the list of trace IDs of the application and then retrieve the list of traces using BatchGetTraces API.
D. Use the GetServiceGraph API to get the list of trace IDs of the application and then retrieve the list of traces using GetTraceSummaries API.

**Correct answer:** C. Use the GetTraceSummaries API to get the list of trace IDs of the application and then retrieve the list of traces using BatchGetTraces API.
