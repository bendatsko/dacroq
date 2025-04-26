%Function that takes in cnf file and return a matrix of Clauses C and the number of variables for the given UNSAT problem

% INPUT :
% path_to_old_cnf - path to original cnf
% path_to_new_cnf - path to dump cnf when it is not 3-SAT
% scheme - Scheme to be decided according to user choice


% OUTPUT :
% file - filepath to new 3-SAT reduced cnf that can be referenced later when needed
% var - The number of variables in the final problem
% NC - The number of Clauses in the final problem
% Clauses -  A matrix (NC by 3) storing the Clauses for easy calculation   

function [file,Clauses,var,NC]= k_sat_read_cnf(path_to_old_cnf,path_to_new_cnf,scheme)
    
    NC=0; % The number of clauses
    m=3; % Define matrix column size to convert to 3-SAT problem
    var=0; %The number of variables
    Clauses =0; % Storing the values for each clause in a matrix
    fid = fopen(path_to_old_cnf);
    file='';

    % Check if unable to read the file
    if fid<0
        return
    end
    k=1;
    nc_o=1;
    l1=0;
    l2=0;
    l3=0;
    l4=0;
    comments={};
    modifiedLines={};
    while ~feof(fid)
        tline = fgetl(fid);
        tline = strtrim(tline);
        if isempty(tline)
            continue;
        end
        if (lower(tline(1))== 'c' || lower(tline(1))== 'p')
            comments{end+1} = tline;
        end
        if (lower(tline(1))=='p')
            X = (string(split(tline)));
            var = str2num(X(end -1));
            varo=var;
            NC= str2num(X(end));
            Clauses = zeros(NC,m); 
            continue;
        end
        if (tline(1)~= 'c')  &&(nc_o<= NC)
            x = str2num(tline);
            l=size(x,2)-1;
            k_sat = l;
            if scheme==1
                if l==1
                    l1=l1+1;
                    v1=var+1;
                    v2=var+1;
                    Clauses(k,:)= [x(1:end-1),v1,v2];
                    Clauses(k+1,:)= [x(1:end-1),v1,-v2];
                    Clauses(k+2,:)= [x(1:end-1),-v1,v2];
                    Clauses(k+3,:)= [x(1:end-1),-v1,-v2];
                    k=k+4;
                    var=v2;
                elseif l==2
                    l2=l2+1;
                    v1=var+1;
                    Clauses(k,:)= [x(1:end-1),v1];
                    Clauses(k+1,:)= [x(1:end-1),-v1];
                    k=k+2;
                    var=v1;
                elseif l==3
                    l3=l3+1;
                    Clauses(k,:)= x(1:end-1);
                    k=k+1;
                else
                    v=[var+1:var+l-3];
                    l4=l4+1;
                    for j=1:l-2
                        if j==1
                            Clauses(k,:)= [x(1:2),v(j)];
                        elseif j==l-2
                            Clauses(k,:)= [x(l-1:l),-v(j-1)];
                        else
                            Clauses(k,:)= [x(j+1),-v(j-1),v(j)];
                        end
                        k=k+1;
                    end
                    var = v(end);
                end
            else
                if l==1
                    l1=l1+1;
                    Clauses(k,:)= [x(1:end-1),x(end),x(end)];
                    k=k+1;
                elseif l==2
                    l2=l2+1;
                    Clauses(k,:)= [x(1:end-1),x(end)];
                    k=k+1;
                elseif l==3
                    l3=l3+1;
                    Clauses(k,:)= x(1:end-1);
                    k=k+1;
                else
                    v=[var+1:var+l-3];
                    l4=l4+1;
                    for j=1:l-2
                        if j==1
                            Clauses(k,:)= [x(1:2),v(j)];
                        elseif j==l-2
                            Clauses(k,:)= [x(l-1:l),-v(j-1)];
                        else
                            Clauses(k,:)= [x(j+1),-v(j-1),v(j)];
                        end
                        k=k+1;
                    end
                    var = v(end);
                end
            end
            nc_o=nc_o+1; % Keeping track of number of original clauses
        end
    end
    fclose(fid);
    NC = size(Clauses,1);
    fprintf('k - SAT : %d\n',k_sat);   % Only for test
    fprintf('#Length 1 clauses before reduction : %d\n',l1);
    fprintf('#Length 2 clauses before reduction : %d\n',l2);
    fprintf('#Length 3 clauses before reduction : %d\n',l3);
    fprintf('#Length >3 clauses before reduction : %d\n',l4);
    fprintf('Total number of variables before reduction : %d\n',varo);
    fprintf('Total number of variables after reduction : %d\n',var);
    fprintf('Total number of clauses after reduction : %d\n',size(Clauses,1));

    if ~(((l1==0) && (l2==0) && (l3~=0) && (l4==0)) || strlength(path_to_new_cnf) == 0)

        % Dump cnf files with new structure only when the original file is not 3-SAT
        Clauses_str = [Clauses, zeros(size(Clauses, 1), 1)];
        rowStrings = arrayfun(@(i) sprintf('%g ', Clauses_str(i, :)), 1:size(Clauses_str, 1), 'UniformOutput', false);
        matrixString = strjoin(rowStrings, '\n');
        for c=comments
            if startsWith(lower(c), 'p')
                str=split(c);
                newstr= join([str(1:end-2)',string(var),string(size(Clauses,1))]);
                modifiedLines{end+1} = newstr;
                modifiedLines{end+1} =matrixString;
            else
                modifiedLines{end+1} = string(c);
            end
        end
        file = fopen(path_to_new_cnf, 'w');
        fprintf(file, '%s\n', modifiedLines{:});
        fclose(file);

    end
end


% Can pass empty string when the sat is already known to be 3-SAT from
% before
% path_to_old_cnf = '/Users/ananyanandy/Documents/ECE_PhD/RESEARCH/FALL_24/DARPA/DARPA_Sets_Jan2024/batch-07/003_2_2.dimacs'
% path_to_new_cnf = '';
% scheme=1;
% k_sat_read_cnf1(path_to_old_cnf,path_to_new_cnf,scheme)
