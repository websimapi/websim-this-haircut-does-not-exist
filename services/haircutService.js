const HaircutService = {
    analyzeAndGenerateHaircut: async (canvas, drawingVectors, isRemixing, remixSourceHaircut) => {
        let isAnalyzing = true;
        let isGenerating = false;
        let isProcessing = true;
        let description = '';
        let generatedImageUrl = '';
        let analyzerPrompt = '';
        let generatorPrompt = '';
        
        try {
            const imageDataUrl = canvas.toDataURL('image/jpeg');
            
            console.log('Starting haircut analysis process');
            console.log('Is remixing:', isRemixing);
            if (isRemixing && remixSourceHaircut) {
                console.log('Remix source haircut data:', remixSourceHaircut);
            }
            
            let systemPrompt = "You are a professional hair stylist with expertise in describing haircuts and styles. Given an image of a drawn haircut or abstract shape, describe what this would look like as an actual haircut in great detail. Focus on length, texture, color, styling techniques, and any distinctive features. Be creative and detailed.";
            let userPrompt = [
                {
                    type: "text",
                    text: "Describe this drawing as if it were a haircut or hairstyle. Be detailed and creative. If it's abstract, interpret what haircut it might represent."
                },
                {
                    type: "image_url",
                    image_url: { url: imageDataUrl }
                }
            ];
            
            // If we're remixing, use a simplified prompt that focuses primarily on the new drawing
            if (isRemixing && remixSourceHaircut) {
                systemPrompt = "You are a professional hair stylist with expertise in creating new haircut designs. Focus primarily on the drawn image to create a detailed haircut description.";
                
                userPrompt = [
                    {
                        type: "text",
                        text: `I'm creating a new haircut based on this drawing. Please analyze the image and describe what this would look like as an actual haircut.
                        
                        Note: This is a remix of a previous haircut which had this description: "${remixSourceHaircut.description}".
                        
                        IMPORTANT: Focus primarily on the new drawing in the image - this should be the main influence for your description. The drawing should drive most of your description, though you can maintain some styling elements from the original description for context.`
                    },
                    {
                        type: "image_url",
                        image_url: { url: imageDataUrl }
                    }
                ];
                
                console.log('Using simplified remix prompt focusing on the new drawing');
            }
            
            console.log('Sending analysis request with prompt:', userPrompt);
            analyzerPrompt = systemPrompt;
            
            const completion = await websim.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: userPrompt
                    }
                ]
            });
            
            console.log('Received haircut description:', completion.content.substring(0, 100) + '...');
            description = completion.content;
            isAnalyzing = false;
            isGenerating = true;
            
            // Now generate the image
            console.log('Generating haircut image from description');
            let imagePrompt = `Professional photograph of a person with the following haircut: ${completion.content}. Professional salon photo, high quality, detailed hair texture, salon lighting.`;
            
            // Add minimal remix context to image generation prompt if applicable
            if (isRemixing && remixSourceHaircut) {
                imagePrompt = `Professional photograph of a person with the following haircut: ${completion.content}. 
                Professional salon photo, high quality, detailed hair texture, salon lighting.`;
            }
            
            generatorPrompt = imagePrompt;
            
            const result = await websim.imageGen({
                prompt: imagePrompt,
                aspect_ratio: "1:1"
            });
            
            console.log('Received generated image URL:', result.url);
            generatedImageUrl = result.url;
            
            const drawingDataUrl = canvas.toDataURL('image/jpeg');
            
            console.log('Uploading drawing to storage');
            const drawingUrl = await websim.upload(
                dataURLtoFile(drawingDataUrl, 'drawing.jpg')
            );
            console.log('Drawing uploaded, URL:', drawingUrl);
            
            // Create new haircut record with remix history if applicable
            let haircutData = {
                description: completion.content,
                drawingUrl,
                haircutUrl: result.url,
                vectors: JSON.stringify(drawingVectors),
                analyzerPrompt: systemPrompt,
                generatorPrompt: imagePrompt,
                userPromptText: typeof userPrompt[0].text === 'string' ? userPrompt[0].text : 'Custom drawing analysis'
            };
            
            // If this is a remix, include the parent haircut info
            if (isRemixing && remixSourceHaircut) {
                console.log('Adding remix information to record');
                haircutData.isRemix = true;
                haircutData.parentId = remixSourceHaircut.id;
                haircutData.originalDrawingUrl = remixSourceHaircut.drawingUrl;
                haircutData.originalHaircutUrl = remixSourceHaircut.haircutUrl;
            }
            
            console.log('Creating haircut record with data:', haircutData);
            const room = new WebsimSocket();
            await room.collection('haircut').create(haircutData);
            console.log('Haircut record created successfully');
            
            return {
                success: true,
                description,
                generatedImageUrl,
                analyzerPrompt,
                generatorPrompt
            };
            
        } catch (error) {
            console.error('Error processing haircut:', error);
            // More detailed error logging
            if (error.response) {
                console.error('Response error details:', error.response);
            }
            
            return {
                success: false,
                error
            };
        } finally {
            isAnalyzing = false;
            isGenerating = false;
            isProcessing = false;
        }
    },
    dataURLtoFile: (dataurl, filename) => {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
    }
};